//! # Kadi — non-custodial creator donations on Solana
//!
//! Creators register a handle, publish goals, and receive donations straight
//! into a per-goal PDA vault they can withdraw from at any time. The protocol
//! fee is split atomically in the same transaction as the donation, so nobody —
//! including the protocol authority — ever custodies a creator's funds.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::GoalStatus;

declare_id!("GusBZT1xMiapNKnen2t67D86QcfQtGfyZvgRmR8hHKvR");

#[program]
pub mod kadi {
    use super::*;

    // --- protocol config ---------------------------------------------------

    pub fn initialize(ctx: Context<Initialize>, fee_bps: u16) -> Result<()> {
        instructions::initialize(ctx, fee_bps)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: Option<u16>,
        treasury: Option<Pubkey>,
        authority: Option<Pubkey>,
    ) -> Result<()> {
        instructions::update_config(ctx, fee_bps, treasury, authority)
    }

    // --- creators ----------------------------------------------------------

    pub fn register_creator(
        ctx: Context<RegisterCreator>,
        handle: String,
        display_name: String,
        bio: String,
        avatar_uri: String,
    ) -> Result<()> {
        instructions::register_creator(ctx, handle, display_name, bio, avatar_uri)
    }

    pub fn update_creator(
        ctx: Context<UpdateCreator>,
        display_name: Option<String>,
        bio: Option<String>,
        avatar_uri: Option<String>,
    ) -> Result<()> {
        instructions::update_creator(ctx, display_name, bio, avatar_uri)
    }

    // --- goals -------------------------------------------------------------

    pub fn create_goal(
        ctx: Context<CreateGoal>,
        title: String,
        description: String,
        target: u64,
        deadline: Option<i64>,
    ) -> Result<()> {
        instructions::create_goal(ctx, title, description, target, deadline)
    }

    pub fn create_token_goal(
        ctx: Context<CreateTokenGoal>,
        title: String,
        description: String,
        target: u64,
        deadline: Option<i64>,
    ) -> Result<()> {
        instructions::create_token_goal(ctx, title, description, target, deadline)
    }

    pub fn set_goal_status(ctx: Context<SetGoalStatus>, status: GoalStatus) -> Result<()> {
        instructions::set_goal_status(ctx, status)
    }

    // --- donations ---------------------------------------------------------

    pub fn donate_sol(ctx: Context<DonateSol>, amount: u64, message: String) -> Result<()> {
        instructions::donate_sol(ctx, amount, message)
    }

    pub fn donate_token(ctx: Context<DonateToken>, amount: u64, message: String) -> Result<()> {
        instructions::donate_token(ctx, amount, message)
    }

    // --- payouts -----------------------------------------------------------

    pub fn claim_sol(ctx: Context<ClaimSol>, amount: Option<u64>) -> Result<()> {
        instructions::claim_sol(ctx, amount)
    }

    pub fn claim_token(ctx: Context<ClaimToken>, amount: Option<u64>) -> Result<()> {
        instructions::claim_token(ctx, amount)
    }
}
