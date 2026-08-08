use anchor_lang::prelude::*;

/// Emitted on every donation. This is what the OBS overlay subscribes to — the
/// donor's message rides along here rather than in an account, so it is
/// permanent in the ledger and free to read, but costs no rent.
#[event]
pub struct DonationEvent {
    pub goal: Pubkey,
    pub creator: Pubkey,
    pub donor: Pubkey,
    /// `Pubkey::default()` for native SOL.
    pub mint: Pubkey,
    /// Gross amount, before the protocol fee.
    pub amount: u64,
    /// Amount that actually landed in the vault.
    pub net: u64,
    pub fee: u64,
    pub message: String,
    /// Goal total after this donation, for overlays that render a progress bar.
    pub raised: u64,
    pub target: u64,
    /// True when this donor had never given to this goal before.
    pub is_first_time: bool,
    pub timestamp: i64,
}

#[event]
pub struct CreatorRegistered {
    pub creator: Pubkey,
    pub owner: Pubkey,
    pub handle: String,
    pub timestamp: i64,
}

#[event]
pub struct GoalCreated {
    pub goal: Pubkey,
    pub creator: Pubkey,
    pub index: u64,
    pub title: String,
    pub mint: Pubkey,
    pub target: u64,
    pub deadline: Option<i64>,
    pub timestamp: i64,
}

#[event]
pub struct FundsClaimed {
    pub goal: Pubkey,
    pub creator: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct GoalStatusChanged {
    pub goal: Pubkey,
    pub status: u8,
    pub timestamp: i64,
}
