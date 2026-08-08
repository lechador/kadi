use anchor_lang::prelude::*;

use crate::{errors::KadiError, state::*};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: any address may collect protocol fees. It is recorded here and
    /// every donation re-validates the passed treasury against this value.
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>, fee_bps: u16) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, KadiError::FeeTooHigh);

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.treasury = ctx.accounts.treasury.key();
    config.fee_bps = fee_bps;
    config.bump = ctx.bumps.config;

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = authority @ KadiError::Unauthorized
    )]
    pub config: Account<'info, Config>,

    pub authority: Signer<'info>,
}

pub fn update_config(
    ctx: Context<UpdateConfig>,
    fee_bps: Option<u16>,
    treasury: Option<Pubkey>,
    authority: Option<Pubkey>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(fee_bps) = fee_bps {
        // The ceiling is enforced here as well as at init, so governance can
        // lower the fee but can never raise it beyond MAX_FEE_BPS.
        require!(fee_bps <= MAX_FEE_BPS, KadiError::FeeTooHigh);
        config.fee_bps = fee_bps;
    }
    if let Some(treasury) = treasury {
        config.treasury = treasury;
    }
    if let Some(authority) = authority {
        config.authority = authority;
    }

    Ok(())
}
