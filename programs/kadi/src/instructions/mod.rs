pub mod claim;
pub mod config;
pub mod creator;
pub mod donate;
pub mod goal;

pub use claim::*;
pub use config::*;
pub use creator::*;
pub use donate::*;
pub use goal::*;

use crate::errors::KadiError;
use crate::state::BPS_DENOMINATOR;
use anchor_lang::prelude::*;

/// Protocol fee, rounded down so the creator is never shorted by rounding.
pub fn compute_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    let fee = (amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(KadiError::Overflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(KadiError::Overflow)?;
    u64::try_from(fee).map_err(|_| KadiError::Overflow.into())
}
