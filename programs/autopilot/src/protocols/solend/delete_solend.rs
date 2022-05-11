use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::errors::AccrueError;
use crate::vault::state::*;
use crate::protocols::protocol::*;
use super::utils::UUID;

/*
delete_solend

Remove protocol from integrated protocols list
*/


#[derive(Accounts)]
pub struct DeleteSolend<'info> {
    #[account(mut)]
    pub vault_creator: Signer<'info>, 

    #[account(mut)]
    pub vault_info: Box<Account<'info, VaultInfo>>,

    #[account(
        seeds = [
            DEST_COLLATERAL_SEED,
            UUID, 
            vault_info.mint.as_ref(),
            vault_info.vault_creator.as_ref()
        ],
        bump = vault_info.get_protocol(UUID.clone())?.destination_collateral_bump.clone(),
    )]
    pub destination_collateral: Box<Account<'info, TokenAccount>>,

    pub clock: Sysvar<'info, Clock>,
}

pub fn handler(
    ctx: Context<DeleteSolend>, 
) -> Result<()> {
    let vault_creator = &mut ctx.accounts.vault_creator;  // must be mut because closing acc
    let vault_info = &mut ctx.accounts.vault_info;
    let destination_collateral = &ctx.accounts.destination_collateral;
    let slot = ctx.accounts.clock.slot;

    // ownership check
    if vault_creator.key() != vault_info.vault_creator {
        return Err(error!(AccrueError::VaultCreatorOwnershipError));
    }

    // protocol exists
    let protocol = vault_info.get_protocol(UUID.clone())?;

    // balance is not stale
    let balance = protocol.get_balance(slot)?;

    // no balance in protocol right now <- REALLY important check
    if (balance != 0u64) || (destination_collateral.amount != 0u64) {
        return Err(error!(AccrueError::ProtocolHasBalanceError));
    }

    // distribution is zero
    if protocol.distribution != 0u64 {
        return Err(error!(AccrueError::ProtocolDistributionNotZeroError));
    }

    // remove protocol if it exists, else throw error
    let index = vault_info.protocols.iter().position(|p| p.uuid == UUID.clone());
    match index {
        Some(i) => vault_info.protocols.remove(i),
        None => return Err(error!(AccrueError::ProtocolDoesNotExist)),
    };

    Ok(())
}