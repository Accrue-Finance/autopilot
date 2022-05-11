use anchor_lang::prelude::*;

use crate::errors::AccrueError;
use crate::pool::pool::Pool;
use crate::protocols::protocol::Protocol;
use super::fees::AccrueFees;


// If you move this, it will probably cause this error: 
// thread 'main' panicked at 'called `Result::unwrap()` on an `Err` value: 
// ParseIntError { kind: InvalidDigit }
pub const UUID_SIZE: usize = 4;  // never change this.


#[account]
pub struct VaultInfo {
    pub version: u8,
    pub cluster: u8,            // 0: devnet, 1: mainnet

    // parties
    pub vault_creator: Pubkey,
    pub client: Pubkey,   // future: if we want to service 1 business and want to have multisig instructions. Immutable after init_vault().

    // parameters
    pub protocols_max: u8,      // maximum size of protocols vec
    pub vault_max: u64,         // maximum funds that can be deposited into vault

    // mints & bumps
    pub mint: Pubkey,
    pub accrue_mint: Pubkey,    // atoken mint
    pub accrue_mint_bump: u8,
    pub vault_info_bump: u8,

    // locations
    pub pool: Pool,
    pub protocols: Vec<Protocol>,

    // fees
    pub fees: AccrueFees,

    // flags
    pub user_withdraws_disabled: bool,

    // extra space
    pub vault_extra_space: [u8; 512],
}

impl VaultInfo {
    // vec needs 4 bytes for length
    pub fn size() -> i32 {
        8 + 1 + 1 + 32 + 32 + 1 + 8 + 32 + 32 + 1 + 1 + Pool::size() + 4 + ((6 as i32) * Protocol::size()) + AccrueFees::size() + 1 + 512
    }

    pub fn get_protocol(&self, uuid: [u8; UUID_SIZE]) -> Result<&Protocol> {
        for protocol in self.protocols.iter() {
            if protocol.uuid == uuid {
                return Ok(protocol);
            }
        }
        return Err(error!(AccrueError::ProtocolUuidConversionError));
    }

    // copy of get_protocol, except mutable
    pub fn get_protocol_mut(&mut self, uuid: [u8; UUID_SIZE]) -> Result<&mut Protocol> {
        for protocol in self.protocols.iter_mut() {
            if protocol.uuid == uuid {
                return Ok(protocol);
            }
        }
        return Err(error!(AccrueError::ProtocolUuidConversionError));
    }

    pub fn get_total_balance(&self, slot: u64) -> Result<u64> {
        let mut balance = self.pool.get_balance(slot)?;
        for protocol in self.protocols.iter() {
            balance = balance
                .checked_add(protocol.get_balance(slot)?)
                .ok_or(AccrueError::OverflowError)?;
        }
        Ok(balance)
    }

    // Sum of all distributions. Should always equal u64::max
    pub fn get_distribution_sum(&self) -> Result<u64> {
        let mut sum = self.pool.distribution;
        for protocol in self.protocols.iter() {
            sum = sum
                .checked_add(protocol.distribution.clone())
                .ok_or(AccrueError::OverflowError)?;
        }

        if sum != u64::MAX {
            return Err(error!(AccrueError::SetDistributionSumError));
        }

        Ok(sum)
    }
}