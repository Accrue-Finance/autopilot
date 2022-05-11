use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount}
};

use crate::{vault::state::*, errors::AccrueError};
use crate::protocols::protocol::*;
use super::utils::*;

/*
init_solend

Initialize the required accounts to integrate with this protocol
Caution: Re-initialization attacks because init_if_needed.
For example, hacker can initialize the ctoken account and send it ctokens, so 
we can't assume that account's balance == 0.
*/


#[derive(Accounts)]
pub struct InitSolend<'info> {
    #[account(mut)]
    pub vault_creator: Signer<'info>, 

    #[account(mut)]
    pub vault_info: Box<Account<'info, VaultInfo>>,

    pub destination_collateral_mint: Box<Account<'info, Mint>>,

    // Use init_if_needed with caution: https://docs.rs/anchor-lang/latest/anchor_lang/derive.Accounts.html
    #[account(
        init_if_needed,
        payer = vault_creator,
        seeds = [
            DEST_COLLATERAL_SEED,
            UUID, 
            vault_info.mint.as_ref(),
            vault_info.vault_creator.as_ref()
        ],
        bump,
        token::mint = destination_collateral_mint,
        token::authority = destination_collateral,
    )]
    pub destination_collateral: Box<Account<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitSolend>, 
) -> Result<()> {
    let vault_creator = &ctx.accounts.vault_creator;
    let vault_info = &mut ctx.accounts.vault_info;
    let destination_collateral_mint = &ctx.accounts.destination_collateral_mint;

    // ownership check
    if vault_creator.key() != vault_info.vault_creator {
        return Err(error!(AccrueError::VaultCreatorOwnershipError));
    }

    // custom protocol logic: destination_collateral_mint
    let expected = get_mint(
        vault_info.cluster,
        vault_info.mint,
    )?;
    if destination_collateral_mint.key() != expected.ctoken {
        return Err(error!(AccrueError::ProtocolCMintMismatchError));
    }

    // protocols_max limit reached
    if vault_info.protocols.len() >= vault_info.protocols_max as usize {
        return Err(error!(AccrueError::ProtocolMaximumError));
    }

    // protocol doesn't already exist
    match vault_info.get_protocol(UUID.clone()) {
        Ok(_) => return Err(error!(AccrueError::ProtocolAlreadyExists)),
        _ => ()
    };

    // Add protocol to vault_info.protocols
    // DO NOT assume that the ctoken account has 0 balance (re-initialization attacks)
    vault_info.protocols.push(Protocol::new(UUID, *ctx.bumps.get("destination_collateral").unwrap()));

    Ok(())
}