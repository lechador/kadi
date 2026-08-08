use anchor_lang::prelude::*;

// ---------------------------------------------------------------------------
// Field limits
//
// These consts are used directly in the `#[max_len(..)]` attributes below, so
// the account size and the runtime validation can never drift apart.
// ---------------------------------------------------------------------------

pub const MIN_HANDLE_LEN: usize = 3;
pub const MAX_HANDLE_LEN: usize = 32; // also the Solana seed limit
pub const MAX_DISPLAY_NAME_LEN: usize = 64;
pub const MAX_BIO_LEN: usize = 200;
pub const MAX_URI_LEN: usize = 200;
pub const MAX_TITLE_LEN: usize = 80;
pub const MAX_DESCRIPTION_LEN: usize = 280;

/// Donation messages are carried in the emitted event, never in an account:
/// permanent in the ledger, retrievable over RPC, but zero rent and no
/// unmoderatable on-chain text.
pub const MAX_MESSAGE_LEN: usize = 200;

/// Hard ceiling on the protocol fee, enforced on-chain. The authority can lower
/// the fee but can never raise it past this, so creators are not exposed to a
/// governance rug. 10%.
pub const MAX_FEE_BPS: u16 = 1_000;
pub const BPS_DENOMINATOR: u128 = 10_000;

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

pub const CONFIG_SEED: &[u8] = b"config";
pub const CREATOR_SEED: &[u8] = b"creator";
pub const GOAL_SEED: &[u8] = b"goal";
pub const VAULT_SEED: &[u8] = b"vault";
pub const SUPPORTER_SEED: &[u8] = b"supporter";

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/// Protocol singleton. Deliberately holds no counters: a global account that
/// every donation had to write to would serialize the entire protocol behind a
/// single write lock. Aggregate stats are derived client-side from
/// `getProgramAccounts` instead.
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

/// A creator profile. The PDA is seeded by the handle itself, which makes
/// handles globally unique for free and lets the frontend resolve
/// `/c/<handle>` to an address with no index or database.
#[account]
#[derive(InitSpace)]
pub struct Creator {
    pub owner: Pubkey,
    #[max_len(MAX_HANDLE_LEN)]
    pub handle: String,
    #[max_len(MAX_DISPLAY_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_BIO_LEN)]
    pub bio: String,
    #[max_len(MAX_URI_LEN)]
    pub avatar_uri: String,
    /// Monotonic counter used to derive the next goal PDA.
    pub goal_count: u64,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum GoalStatus {
    Active,
    Completed,
    Archived,
}

/// A fundraising goal. Donations for it accumulate in a separate vault PDA so
/// that rent-exemption of this data account is never entangled with the
/// claimable balance.
#[account]
#[derive(InitSpace)]
pub struct Goal {
    /// The `Creator` PDA this goal belongs to.
    pub creator: Pubkey,
    /// The creator's wallet, denormalised so `claim` needs one less account.
    pub owner: Pubkey,
    pub index: u64,
    #[max_len(MAX_TITLE_LEN)]
    pub title: String,
    #[max_len(MAX_DESCRIPTION_LEN)]
    pub description: String,
    /// `Pubkey::default()` means this goal is denominated in native SOL.
    pub mint: Pubkey,
    pub target: u64,
    /// Gross total ever donated, in the goal's denomination. Never decremented,
    /// so the progress bar only ever moves forward even after a claim.
    pub raised: u64,
    /// Cumulative amount withdrawn by the creator.
    pub claimed: u64,
    pub donation_count: u64,
    pub supporter_count: u64,
    pub status: GoalStatus,
    pub created_at: i64,
    pub deadline: Option<i64>,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Goal {
    pub fn is_native(&self) -> bool {
        self.mint == Pubkey::default()
    }
}

/// One account per unique (goal, donor) pair. Gives on-chain leaderboards with
/// bounded growth — a repeat donor updates their existing account rather than
/// creating a new receipt every time.
#[account]
#[derive(InitSpace)]
pub struct Supporter {
    pub goal: Pubkey,
    pub donor: Pubkey,
    pub total: u64,
    pub count: u64,
    pub first_donated_at: i64,
    pub last_donated_at: i64,
    pub bump: u8,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Handles are the public identity of a creator and appear in URLs, so they are
/// restricted to an unambiguous character set: lowercase ASCII, digits and
/// underscore. This also rules out homograph impersonation of other creators.
pub fn is_valid_handle(handle: &str) -> bool {
    let len = handle.len();
    if !(MIN_HANDLE_LEN..=MAX_HANDLE_LEN).contains(&len) {
        return false;
    }
    handle
        .bytes()
        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
}
