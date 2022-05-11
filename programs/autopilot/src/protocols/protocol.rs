use anchor_lang::prelude::*;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;

use crate::errors::AccrueError;
use crate::vault::state::*;

pub const DEST_COLLATERAL_SEED: &[u8; 4] = b"DSTC";

#[derive(Clone, Copy, Debug, AnchorSerialize, AnchorDeserialize)]
pub struct Protocol {
    pub uuid: [u8; UUID_SIZE],
    // if we cannot pull all money out bc of utilization, rate starts spiking,
    // we don't want to accidentally put more money into that protocol.
    pub deposits_disabled: bool, 
    pub distribution: u64,
    balance: u64,  // should be private
    pub last_update: LastUpdate,
    pub destination_collateral_bump: u8,
    pub protocol_extra_data: [u8; 64],
}

impl Protocol {
    pub fn size() -> i32 {
        (UUID_SIZE as i32) + 1 + 8 + 8 + LastUpdate::size() + 1 + 64
    }

    pub fn new(uuid: &[u8; UUID_SIZE], destination_collateral_bump: u8) -> Self {
        Self {
            uuid: uuid.clone(),
            deposits_disabled: false,
            distribution: 0u64,
            balance: 0u64,
            last_update: LastUpdate::new(),
            destination_collateral_bump,
            protocol_extra_data: [0; 64],
        }
    }

    // Note: This should be a replica of pool.get_balance()
    pub fn get_balance(&self, slot: u64) -> Result<u64> {
        let is_stale = self.last_update.is_stale(slot)?;
        if is_stale {
            return Err(error!(AccrueError::LocationStaleError));
        }
        Ok(self.balance)
    }

    // Note: This should be a replica of pool.update_balance()
    pub fn update_balance(&mut self, slot: u64, balance: u64) -> u64 {
        self.balance = balance;
        self.last_update.update_slot(slot);
        balance
    }

    // given protocol.distribution and the total balance, 
    // calculate how many tokens we want to keep in this protocol
    pub fn calc_desired_balance(&self, vault_info: &Account<VaultInfo>, total_balance: u64) -> Result<u64> {
        let distribution_sum = vault_info.get_distribution_sum()?;
        if self.distribution == 0 {
            return Ok(0u64);
        } else if self.distribution == distribution_sum {
            return Ok(total_balance);
        } else {
            let total_balance_decimal = Decimal::from(total_balance);
            let distribution_decimal = Decimal::from(self.distribution);
            let total_distribution_decimal = Decimal::from(distribution_sum);

            // floor(total_balance * distribution / U64_MAX)
            let desired_balance_decimal = total_balance_decimal
                .checked_div(total_distribution_decimal)
                .ok_or(AccrueError::OverflowError)?
                .checked_mul(distribution_decimal)
                .ok_or(AccrueError::OverflowError)?
                .floor()
                .to_u64()
                .ok_or(AccrueError::OverflowError)?;

            return Ok(desired_balance_decimal);
        }
    }
}