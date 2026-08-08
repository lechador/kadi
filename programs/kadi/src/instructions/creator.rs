use anchor_lang::prelude::*;

use crate::{errors::KadiError, events::CreatorRegistered, state::*};

#[derive(Accounts)]
#[instruction(handle: String)]
pub struct RegisterCreator<'info> {
    /// Seeded by the handle itself: uniqueness is enforced by the runtime (a
    /// second `init` at the same address fails) and `/c/<handle>` resolves to
    /// an address with no index or database.
    #[account(
        init,
        payer = owner,
        space = 8 + Creator::INIT_SPACE,
        seeds = [CREATOR_SEED, handle.as_bytes()],
        bump
    )]
    pub creator: Account<'info, Creator>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn register_creator(
    ctx: Context<RegisterCreator>,
    handle: String,
    display_name: String,
    bio: String,
    avatar_uri: String,
) -> Result<()> {
    require!(is_valid_handle(&handle), KadiError::InvalidHandle);
    require!(
        display_name.len() <= MAX_DISPLAY_NAME_LEN,
        KadiError::DisplayNameTooLong
    );
    require!(bio.len() <= MAX_BIO_LEN, KadiError::BioTooLong);
    require!(avatar_uri.len() <= MAX_URI_LEN, KadiError::UriTooLong);

    let now = Clock::get()?.unix_timestamp;
    let creator = &mut ctx.accounts.creator;

    creator.owner = ctx.accounts.owner.key();
    creator.handle = handle.clone();
    creator.display_name = display_name;
    creator.bio = bio;
    creator.avatar_uri = avatar_uri;
    creator.goal_count = 0;
    creator.created_at = now;
    creator.bump = ctx.bumps.creator;

    emit!(CreatorRegistered {
        creator: creator.key(),
        owner: creator.owner,
        handle,
        timestamp: now,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateCreator<'info> {
    #[account(
        mut,
        seeds = [CREATOR_SEED, creator.handle.as_bytes()],
        bump = creator.bump,
        has_one = owner @ KadiError::Unauthorized
    )]
    pub creator: Account<'info, Creator>,

    pub owner: Signer<'info>,
}

pub fn update_creator(
    ctx: Context<UpdateCreator>,
    display_name: Option<String>,
    bio: Option<String>,
    avatar_uri: Option<String>,
) -> Result<()> {
    let creator = &mut ctx.accounts.creator;

    if let Some(display_name) = display_name {
        require!(
            display_name.len() <= MAX_DISPLAY_NAME_LEN,
            KadiError::DisplayNameTooLong
        );
        creator.display_name = display_name;
    }
    if let Some(bio) = bio {
        require!(bio.len() <= MAX_BIO_LEN, KadiError::BioTooLong);
        creator.bio = bio;
    }
    if let Some(avatar_uri) = avatar_uri {
        require!(avatar_uri.len() <= MAX_URI_LEN, KadiError::UriTooLong);
        creator.avatar_uri = avatar_uri;
    }

    Ok(())
}
