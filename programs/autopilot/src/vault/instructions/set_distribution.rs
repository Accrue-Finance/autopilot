use anchor_lang::prelude::*;

use crate::errors::AccrueError;
use crate::vault::*;
use crate::pool::POOL_UUID;

/*
set_distribution

Set distribution to where the money should be moved (e.g. vault: 10%, solend: 90%, ...)
Each distribution value is a u64 (e.g. 100% -> u64::max, 50% -> u64::max / 2)
Can only be called by vault_creator.
*/

#[derive(Accounts)]
pub struct SetDistribution<'info> {
    #[account(mut)]
    pub vault_creator: Signer<'info>, 

    #[account(mut)]
    pub vault_info: Box<Account<'info, VaultInfo>>,
}


pub fn handler(
    ctx: Context<SetDistribution>, 
    locations: Vec<[u8; 4]>,  // vector of pool UUID ad protocol UUIDs (e.g. ["POOL", "SLND"])
    distribution: Vec<u64>,  
    deposits_disabled: Vec<bool>,  // vector of booleans of if we should disable deposits for this location
) -> Result<()> {
    let vault_creator = &ctx.accounts.vault_creator;
    let vault_info = &mut ctx.accounts.vault_info;

    // vault ownership
    if vault_creator.key() != vault_info.vault_creator {
        return Err(error!(AccrueError::VaultCreatorOwnershipError));
    }

    // length: arrays
    if  (locations.len() != vault_info.protocols.len() + 1) ||  // + 1 for pool
        (distribution.len() != vault_info.protocols.len() + 1) || 
        (deposits_disabled.len() != vault_info.protocols.len() + 1)
    {
        return Err(error!(AccrueError::SetDistributionLengthError));
    }

    // ensure each UUID is correct length, and ensure all value of `locations` vector are unique
    let mut seen_uuids: Vec<[u8; 4]> = vec![];
    for location in locations.iter() {
        if location.len() != UUID_SIZE {
            return Err(error!(AccrueError::SetDistributionLengthError));
        }
        if seen_uuids.contains(&location) {
            return Err(error!(AccrueError::SetDistributionDuplicateUuidError));
        }
        seen_uuids.push(location.clone());
    }

    if !seen_uuids.contains(POOL_UUID) {
        return Err(error!(AccrueError::SetDistributionMissingPoolError));
    }
    
    // set distribution and deposits_disabled
    for (i, uuid) in locations.iter().enumerate() {
        if uuid == POOL_UUID {
            vault_info.pool.distribution = distribution[i];
        } else { 
            let location = vault_info.get_protocol_mut(uuid.clone())?;
            location.distribution = distribution[i];
            location.deposits_disabled = deposits_disabled[i];
        }
    }
    
    // distribution sums to u64::MAX, else throw error
    vault_info.get_distribution_sum()?;

    Ok(())
}