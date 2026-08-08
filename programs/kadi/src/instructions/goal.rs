use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    errors::KadiError,
    events::{GoalCreated, GoalStatusChanged},
    state::*,
};

/// Shared validation + field population for both SOL and SPL goals.
#[allow(clippy::too_many_arguments)]
fn init_goal(
    goal: &mut Account<Goal>,
    creator: &mut Account<Creator>,
    owner: Pubkey,
    mint: Pubkey,
    title: String,
    description: String,
    target: u64,
    deadline: Option<i64>,
    goal_bump: u8,
    vault_bump: u8,
) -> Result<i64> {
    require!(!title.is_empty(), KadiError::TitleEmpty);
    require!(title.len() <= MAX_TITLE_LEN, KadiError::TitleTooLong);
    require!(
        description.len() <= MAX_DESCRIPTION_LEN,
        KadiError::DescriptionTooLong
    );
    require!(target > 0, KadiError::InvalidTarget);

    let now = Clock::get()?.unix_timestamp;
    if let Some(deadline) = deadline {
        require!(deadline > now, KadiError::InvalidDeadline);
    }

    goal.creator = creator.key();
    goal.owner = owner;
    goal.index = creator.goal_count;
    goal.title = title;
    goal.description = description;
    goal.mint = mint;
    goal.target = target;
    goal.raised = 0;
    goal.claimed = 0;
    goal.donation_count = 0;
    goal.supporter_count = 0;
    goal.status = GoalStatus::Active;
    goal.created_at = now;
    goal.deadline = deadline;
    goal.bump = goal_bump;
    goal.vault_bump = vault_bump;

    creator.goal_count = creator
        .goal_count
        .checked_add(1)
        .ok_or(KadiError::Overflow)?;

    Ok(now)
}

// ---------------------------------------------------------------------------
// Native SOL goal
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct CreateGoal<'info> {
    #[account(
        mut,
        seeds = [CREATOR_SEED, creator.handle.as_bytes()],
        bump = creator.bump,
        has_one = owner @ KadiError::Unauthorized
    )]
    pub creator: Account<'info, Creator>,

    #[account(
        init,
        payer = owner,
        space = 8 + Goal::INIT_SPACE,
        seeds = [GOAL_SEED, creator.key().as_ref(), creator.goal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub goal: Account<'info, Goal>,

    /// Donations accumulate here rather than on the `goal` data account, so the
    /// claimable balance is never entangled with that account's rent.
    #[account(
        mut,
        seeds = [VAULT_SEED, goal.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_goal(
    ctx: Context<CreateGoal>,
    title: String,
    description: String,
    target: u64,
    deadline: Option<i64>,
) -> Result<()> {
    let now = init_goal(
        &mut ctx.accounts.goal,
        &mut ctx.accounts.creator,
        ctx.accounts.owner.key(),
        Pubkey::default(),
        title.clone(),
        description,
        target,
        deadline,
        ctx.bumps.goal,
        ctx.bumps.vault,
    )?;

    // Seed the vault to the rent-exempt minimum up front. That guarantees the
    // account exists before the first donation and gives `claim` a fixed floor
    // it can never withdraw past, so an active goal's vault can't be closed.
    let rent_min = Rent::get()?.minimum_balance(0);
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        rent_min,
    )?;

    emit!(GoalCreated {
        goal: ctx.accounts.goal.key(),
        creator: ctx.accounts.creator.key(),
        index: ctx.accounts.goal.index,
        title,
        mint: Pubkey::default(),
        target,
        deadline,
        timestamp: now,
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// SPL token goal (USDC and friends)
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct CreateTokenGoal<'info> {
    #[account(
        mut,
        seeds = [CREATOR_SEED, creator.handle.as_bytes()],
        bump = creator.bump,
        has_one = owner @ KadiError::Unauthorized
    )]
    pub creator: Account<'info, Creator>,

    #[account(
        init,
        payer = owner,
        space = 8 + Goal::INIT_SPACE,
        seeds = [GOAL_SEED, creator.key().as_ref(), creator.goal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub goal: Account<'info, Goal>,

    /// Still created for token goals: it owns the vault token account, so the
    /// vault address derivation stays identical across both goal kinds.
    #[account(
        mut,
        seeds = [VAULT_SEED, goal.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn create_token_goal(
    ctx: Context<CreateTokenGoal>,
    title: String,
    description: String,
    target: u64,
    deadline: Option<i64>,
) -> Result<()> {
    let mint = ctx.accounts.mint.key();
    let now = init_goal(
        &mut ctx.accounts.goal,
        &mut ctx.accounts.creator,
        ctx.accounts.owner.key(),
        mint,
        title.clone(),
        description,
        target,
        deadline,
        ctx.bumps.goal,
        ctx.bumps.vault,
    )?;

    // The vault PDA is the token account's authority, so it must be rent-exempt
    // to exist as a signer-capable account.
    let rent_min = Rent::get()?.minimum_balance(0);
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        rent_min,
    )?;

    emit!(GoalCreated {
        goal: ctx.accounts.goal.key(),
        creator: ctx.accounts.creator.key(),
        index: ctx.accounts.goal.index,
        title,
        mint,
        target,
        deadline,
        timestamp: now,
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct SetGoalStatus<'info> {
    #[account(mut, has_one = owner @ KadiError::Unauthorized)]
    pub goal: Account<'info, Goal>,

    pub owner: Signer<'info>,
}

pub fn set_goal_status(ctx: Context<SetGoalStatus>, status: GoalStatus) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let goal = &mut ctx.accounts.goal;
    goal.status = status;

    emit!(GoalStatusChanged {
        goal: goal.key(),
        status: status as u8,
        timestamp: now,
    });

    Ok(())
}
