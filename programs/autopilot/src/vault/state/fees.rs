use anchor_lang::prelude::*;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use crate::errors::AccrueError;

#[derive(Clone, Copy, Debug, AnchorSerialize, AnchorDeserialize)]
pub struct AccrueFees {
    pub deposit_fee: u64,  // divide by U64_MAX to get decimal representation
    pub withdraw_fee: u64,
    pub interest_fee: u64,

    // Interest fee calculation
    pub balance_estimate: u64,  // NEVER use this for actual balance calculations. See Notion for explanation
    pub collectible_fee: u64,

    pub fees_extra_data: [u8; 64],
}

impl AccrueFees {
    pub fn size() -> i32 {
        8 + 8 + 8 + 8 + 8 + 64
    }

    // Calculates (fee_rate / U64_MAX) * amount. E.g. you want to take 10% fees on $50 of interest
    pub fn calc_fee(fee_rate: u64, amount: u64) -> Result<u64> {
        let fee_rate_decimal = Decimal::from(fee_rate);
        let u64_max_decimal = Decimal::from(u64::MAX);
        let amount_decimal = Decimal::from(amount);
        let fee = fee_rate_decimal
            .checked_div(u64_max_decimal)
            .ok_or(AccrueError::OverflowError)?
            .checked_mul(amount_decimal)
            .ok_or(AccrueError::OverflowError)?
            .floor()
            .to_u64()
            .ok_or(AccrueError::OverflowError)?;
        Ok(fee)
    }

    // Calculates the fee for the interest that has accumulated since last external balance change
    // (External balance changes: deposit or withdraw by user, or collect_fees by vault_creator)
    pub fn update_interest_fee(&mut self, new_total_balance: u64) -> Result<()> {
        if new_total_balance > self.balance_estimate {
            let interest_accrued = new_total_balance
                .checked_sub(self.balance_estimate)
                .ok_or(AccrueError::OverflowError)?;
            let interest_accrued_fee = AccrueFees::calc_fee(self.interest_fee, interest_accrued)?;
            self.collectible_fee = self.collectible_fee
                .checked_add(interest_accrued_fee)
                .ok_or(AccrueError::OverflowError)?;
        };
        Ok(())
    }
}
