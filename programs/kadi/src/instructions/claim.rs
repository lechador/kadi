use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{errors::KadiError, events::FundsClaimed, state::*};

// ---------------------------------------------------------------------------
// SOL
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct ClaimSol<'info> {
    #[account(mut, has_one = owner @ KadiError::Unauthorized)]
    pub goal: Account<'info, Goal>,

    #[account(
        mut,
        seeds = [VAULT_SEED, goal.key().as_ref()],
        bump = goal.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Withdraw from the goal vault. `amount: None` claims everything available.
///
/// The claimable balance is read from the vault's actual lamports rather than
/// from a running counter, so no accounting drift is possible — whatever is
/// really there, minus the rent-exempt floor, is what the creator can take.
pub fn claim_sol(ctx: Context<ClaimSol>, amount: Option<u64>) -> Result<()> {
    require!(ctx.accounts.goal.is_native(), KadiError::NotNativeGoal);

    let rent_min = Rent::get()?.minimum_balance(0);
    let available = ctx.accounts.vault.lamports().saturating_sub(rent_min);
    let amount = amount.unwrap_or(available);

    require!(amount > 0, KadiError::InvalidAmount);
    require!(amount <= available, KadiError::InsufficientFunds);

    let goal_key = ctx.accounts.goal.key();
    let vault_bump = ctx.accounts.goal.vault_bump;
    let vault_seeds: &[&[u8]] = &[VAULT_SEED, goal_key.as_ref(), &[vault_bump]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.owner.to_account_info(),
            },
            &[vault_seeds],
        ),
        amount,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let goal = &mut ctx.accounts.goal;
    goal.claimed = goal.claimed.checked_add(amount).ok_or(KadiError::Overflow)?;

    emit!(FundsClaimed {
        goal: goal.key(),
        creator: goal.creator,
        owner: goal.owner,
        mint: Pubkey::default(),
        amount,
        timestamp: now,
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// SPL token
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct ClaimToken<'info> {
    #[account(
        mut,
        has_one = owner @ KadiError::Unauthorized,
        has_one = mint @ KadiError::MintMismatch
    )]
    pub goal: Account<'info, Goal>,

    #[account(
        seeds = [VAULT_SEED, goal.key().as_ref()],
        bump = goal.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn claim_token(ctx: Context<ClaimToken>, amount: Option<u64>) -> Result<()> {
    let available = ctx.accounts.vault_token_account.amount;
    let amount = amount.unwrap_or(available);

    require!(amount > 0, KadiError::InvalidAmount);
    require!(amount <= available, KadiError::InsufficientFunds);

    let goal_key = ctx.accounts.goal.key();
    let vault_bump = ctx.accounts.goal.vault_bump;
    let vault_seeds: &[&[u8]] = &[VAULT_SEED, goal_key.as_ref(), &[vault_bump]];
    let decimals = ctx.accounts.mint.decimals;

    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.owner_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_seeds],
        ),
        amount,
        decimals,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let goal = &mut ctx.accounts.goal;
    goal.claimed = goal.claimed.checked_add(amount).ok_or(KadiError::Overflow)?;

    emit!(FundsClaimed {
        goal: goal.key(),
        creator: goal.creator,
        owner: goal.owner,
        mint: goal.mint,
        amount,
        timestamp: now,
    });

    Ok(())
}
