use anchor_lang::prelude::*;

#[error_code]
pub enum KadiError {
    #[msg("Handle must be 3-32 characters of lowercase a-z, 0-9 or underscore")]
    InvalidHandle,
    #[msg("Display name is too long")]
    DisplayNameTooLong,
    #[msg("Bio is too long")]
    BioTooLong,
    #[msg("URI is too long")]
    UriTooLong,
    #[msg("Goal title is too long")]
    TitleTooLong,
    #[msg("Goal description is too long")]
    DescriptionTooLong,
    #[msg("Donation message is too long")]
    MessageTooLong,
    #[msg("Title cannot be empty")]
    TitleEmpty,
    #[msg("Protocol fee exceeds the hard ceiling of 10%")]
    FeeTooHigh,
    #[msg("Goal target must be greater than zero")]
    InvalidTarget,
    #[msg("Deadline must be in the future")]
    InvalidDeadline,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Goal is not accepting donations")]
    GoalNotActive,
    #[msg("Goal deadline has passed")]
    GoalExpired,
    #[msg("Only the creator who owns this goal can do that")]
    Unauthorized,
    #[msg("Requested amount exceeds the claimable balance")]
    InsufficientFunds,
    #[msg("This goal is denominated in SOL")]
    NotTokenGoal,
    #[msg("This goal is denominated in an SPL token")]
    NotNativeGoal,
    #[msg("Token mint does not match the goal's denomination")]
    MintMismatch,
    #[msg("Arithmetic overflow")]
    Overflow,
}
