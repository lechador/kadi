use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{errors::KadiError, events::DonationEvent, instructions::compute_fee, state::*};

/// Result of the shared bookkeeping both donation paths perform.
struct Applied {
    net: u64,
    fee: u64,
    is_first_time: bool,
    now: i64,
}

/// Validates the goal is donatable, computes the fee split, and applies it to
/// the goal and supporter accounts. Callers move the funds themselves, since
/// SOL and SPL use different transfer mechanics.
fn apply_donation(
    goal: &mut Account<Goal>,
    supporter: &mut Account<Supporter>,
    supporter_bump: u8,
    donor: Pubkey,
    amount: u64,
    message_len: usize,
    fee_bps: u16,
    expect_native: bool,
) -> Result<Applied> {
    require!(amount > 0, KadiError::InvalidAmount);
    require!(message_len <= MAX_MESSAGE_LEN, KadiError::MessageTooLong);
    if expect_native {
        require!(goal.is_native(), KadiError::NotNativeGoal);
    } else {
        require!(!goal.is_native(), KadiError::NotTokenGoal);
    }
    require!(goal.status == GoalStatus::Active, KadiError::GoalNotActive);

    let now = Clock::get()?.unix_timestamp;
    if let Some(deadline) = goal.deadline {
        require!(now <= deadline, KadiError::GoalExpired);
    }

    let fee = compute_fee(amount, fee_bps)?;
    let net = amount.checked_sub(fee).ok_or(KadiError::Overflow)?;

    let is_first_time = supporter.count == 0;
    if is_first_time {
        supporter.goal = goal.key();
        supporter.donor = donor;
        supporter.first_donated_at = now;
        supporter.bump = supporter_bump;
        goal.supporter_count = goal
            .supporter_count
            .checked_add(1)
            .ok_or(KadiError::Overflow)?;
    }
    supporter.total = supporter
        .total
        .checked_add(amount)
        .ok_or(KadiError::Overflow)?;
    supporter.count = supporter.count.checked_add(1).ok_or(KadiError::Overflow)?;
    supporter.last_donated_at = now;

    // `raised` tracks the gross amount so the progress bar reflects what donors
    // actually gave, and it is never decremented by a claim.
    goal.raised = goal.raised.checked_add(amount).ok_or(KadiError::Overflow)?;
    goal.donation_count = goal
        .donation_count
        .checked_add(1)
        .ok_or(KadiError::Overflow)?;

    Ok(Applied {
        net,
        fee,
        is_first_time,
        now,
    })
}

// ---------------------------------------------------------------------------
// SOL
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct DonateSol<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub goal: Account<'info, Goal>,

    #[account(
        mut,
        seeds = [VAULT_SEED, goal.key().as_ref()],
        bump = goal.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: constrained to the treasury recorded in config, so a caller
    /// cannot redirect the protocol fee to themselves.
    #[account(mut, address = config.treasury @ KadiError::Unauthorized)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = donor,
        space = 8 + Supporter::INIT_SPACE,
        seeds = [SUPPORTER_SEED, goal.key().as_ref(), donor.key().as_ref()],
        bump
    )]
    pub supporter: Account<'info, Supporter>,

    #[account(mut)]
    pub donor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn donate_sol(ctx: Context<DonateSol>, amount: u64, message: String) -> Result<()> {
    let fee_bps = ctx.accounts.config.fee_bps;
    let donor = ctx.accounts.donor.key();

    let applied = apply_donation(
        &mut ctx.accounts.goal,
        &mut ctx.accounts.supporter,
        ctx.bumps.supporter,
        donor,
        amount,
        message.len(),
        fee_bps,
        true,
    )?;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.donor.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        applied.net,
    )?;

    if applied.fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.donor.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            applied.fee,
        )?;
    }

    let goal = &ctx.accounts.goal;
    emit!(DonationEvent {
        goal: goal.key(),
        creator: goal.creator,
        donor,
        mint: Pubkey::default(),
        amount,
        net: applied.net,
        fee: applied.fee,
        message,
        raised: goal.raised,
        target: goal.target,
        is_first_time: applied.is_first_time,
        timestamp: applied.now,
    });

    Ok(())
}

// ---------------------------------------------------------------------------
// SPL token
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct DonateToken<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut, has_one = mint @ KadiError::MintMismatch)]
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
        mut,
        associated_token::mint = mint,
        associated_token::authority = donor,
        associated_token::token_program = token_program
    )]
    pub donor_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: constrained to the treasury recorded in config.
    #[account(address = config.treasury @ KadiError::Unauthorized)]
    pub treasury: UncheckedAccount<'info>,

    /// Created on first use for this mint; the donor covers the rent once and
    /// every later donation reuses it.
    #[account(
        init_if_needed,
        payer = donor,
        associated_token::mint = mint,
        associated_token::authority = treasury,
        associated_token::token_program = token_program
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = donor,
        space = 8 + Supporter::INIT_SPACE,
        seeds = [SUPPORTER_SEED, goal.key().as_ref(), donor.key().as_ref()],
        bump
    )]
    pub supporter: Account<'info, Supporter>,

    #[account(mut)]
    pub donor: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn donate_token(ctx: Context<DonateToken>, amount: u64, message: String) -> Result<()> {
    let fee_bps = ctx.accounts.config.fee_bps;
    let donor = ctx.accounts.donor.key();
    let decimals = ctx.accounts.mint.decimals;

    let applied = apply_donation(
        &mut ctx.accounts.goal,
        &mut ctx.accounts.supporter,
        ctx.bumps.supporter,
        donor,
        amount,
        message.len(),
        fee_bps,
        false,
    )?;

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.donor_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.donor.to_account_info(),
            },
        ),
        applied.net,
        decimals,
    )?;

    if applied.fee > 0 {
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.donor_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.donor.to_account_info(),
                },
            ),
            applied.fee,
            decimals,
        )?;
    }

    let goal = &ctx.accounts.goal;
    emit!(DonationEvent {
        goal: goal.key(),
        creator: goal.creator,
        donor,
        mint: goal.mint,
        amount,
        net: applied.net,
        fee: applied.fee,
        message,
        raised: goal.raised,
        target: goal.target,
        is_first_time: applied.is_first_time,
        timestamp: applied.now,
    });

    Ok(())
}
