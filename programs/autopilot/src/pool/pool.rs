use anchor_lang::prelude::*;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;

use crate::errors::AccrueError;
use crate::vault::state::*;


// never change this.
pub const POOL_UUID: &[u8; UUID_SIZE] = b"POOL";  
pub const POOL_SEED: &[u8; UUID_SIZE] = b"pool";

#[derive(Clone, Copy, Debug, AnchorSerialize, AnchorDeserialize)]
pub struct Pool {
    pub uuid: [u8; UUID_SIZE],
    pub bump: u8,
    pub distribution: u64,
    balance: u64,  // should be private
    pub last_update: LastUpdate,
    pub pool_extra_data: [u8; 64],
}

pub struct CalcAtokensToMintParams {
    pub deposit_token_amount: u64,
    pub total_balance: u64,
    pub supply_before: u64,
    pub fees: AccrueFees,
}

pub struct CalcTokensToReturnParams {
    pub withdraw_atoken_amount: u64,
    pub total_balance: u64,
    pub supply_before: u64,
    pub fees: AccrueFees,
}

impl Pool {
    pub fn size() -> i32 {
        (UUID_SIZE as i32) + 1 + 8 + 8 + LastUpdate::size() + 64
    }

    pub fn new(bump: u8) -> Self {
        Self { 
            uuid: POOL_UUID.clone(),
            bump,
            distribution: u64::MAX,
            balance: 0u64,
            last_update: LastUpdate::new(),
            pool_extra_data: [0; 64],
        }
    }

    // Note: This should be a replica of protocol.get_balance()
    pub fn get_balance(&self, slot: u64) -> Result<u64> {
        let is_stale = self.last_update.is_stale(slot)?;
        if is_stale {
            return Err(error!(AccrueError::LocationStaleError));
        }
        Ok(self.balance)
    }

    // Note: This should be a replica of protocol.update_balance()
    pub fn update_balance(&mut self, slot: u64, balance: u64) -> u64 {
        self.balance = balance;
        self.last_update.update_slot(slot);
        balance
    }

    pub fn calc_atokens_to_mint(params: CalcAtokensToMintParams) -> Result<[u64; 2]> {
        let deposit_fee = AccrueFees::calc_fee(params.fees.deposit_fee, params.deposit_token_amount)?;
        let deposit_amount_after_fee = params.deposit_token_amount
            .checked_sub(deposit_fee)
            .ok_or(AccrueError::OverflowError)?;

        if params.total_balance == 0u64 {
            return Ok([deposit_amount_after_fee, deposit_fee]);
        }
        
        let total_balance_minus_fee = params.total_balance
            .checked_sub(params.fees.collectible_fee)
            .ok_or(AccrueError::OverflowError)?;

        if total_balance_minus_fee == 0u64 {
            return Ok([deposit_amount_after_fee, deposit_fee]);
        }

        // Say someone sent money to the pool before the first user deposited.
        // Then, we'd be minting the user 0 aTokens when they deposit (because tot_bal_min_fees != 0, but supply == 0)
        if params.supply_before == 0u64 {
            return Err(error!(AccrueError::OverflowError));
        }

        // deposit_amount * supply_before / total_balance
        let deposit_amount_after_fee_decimal = Decimal::from(deposit_amount_after_fee);
        let supply_before_decimal = Decimal::from(params.supply_before);
        let total_balance_minus_fee_decimal = Decimal::from(total_balance_minus_fee);

        let atokens_to_mint = deposit_amount_after_fee_decimal
            .checked_div(total_balance_minus_fee_decimal)
            .ok_or(AccrueError::OverflowError)?
            .checked_mul(supply_before_decimal)
            .ok_or(AccrueError::OverflowError)?
            .floor()
            .to_u64()
            .ok_or(AccrueError::OverflowError)?;

        return Ok([atokens_to_mint, deposit_fee]);
    }

    pub fn calc_tokens_to_return(params: CalcTokensToReturnParams) -> Result<[u64; 2]> {
        let total_balance_minus_fee = params.total_balance
            .checked_sub(params.fees.collectible_fee)
            .ok_or(AccrueError::OverflowError)?;
        
        let withdraw_atoken_amount_decimal = Decimal::from(params.withdraw_atoken_amount);
        let total_balance_minus_fee_decimal = Decimal::from(total_balance_minus_fee);
        let supply_before_decimal = Decimal::from(params.supply_before);

        let tokens_before_fee = withdraw_atoken_amount_decimal
            .checked_div(supply_before_decimal)
            .ok_or(AccrueError::OverflowError)?
            .checked_mul(total_balance_minus_fee_decimal)
            .ok_or(AccrueError::OverflowError)?
            .floor()
            .to_u64()
            .ok_or(AccrueError::OverflowError)?;

        let withdraw_fee = AccrueFees::calc_fee(params.fees.withdraw_fee, tokens_before_fee)?;
        let tokens_to_return = tokens_before_fee
            .checked_sub(withdraw_fee)
            .ok_or(AccrueError::OverflowError)?;
        
        return Ok([tokens_to_return, withdraw_fee]);
    }
}
