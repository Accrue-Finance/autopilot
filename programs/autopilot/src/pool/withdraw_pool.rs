use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Burn, Mint, Token, TokenAccount},
};

use crate::{state::*, errors::AccrueError};
use super::pool::*;

/*
withdraw_pool

Withdraws user's tokens from the pool.
*/

#[derive(Accounts)]
pub struct WithdrawPool<'info> {  // some parameters should be identical to deposit's Context
    #[account(mut)]
    pub withdrawer: Signer<'info>, 

    #[account(mut)]
    pub vault_info: Box<Account<'info, VaultInfo>>,

    #[account(
        mut,
        seeds = [POOL_SEED, vault_info.mint.as_ref(), vault_info.vault_creator.as_ref()],
        bump = vault_info.pool.bump,
        // ^ make sure to use vault_info.* for seeds and bump so we check vault_info.pool == pool
    )]
    pub pool: Box<Account<'info, TokenAccount>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"accrue_mint", vault_info.mint.as_ref(), vault_info.vault_creator.as_ref()],
        bump = vault_info.accrue_mint_bump,
        // ^ make sure to use vault_info.* for seeds and bump so we check vault_info.pool == pool
    )]
    pub accrue_mint: Box<Account<'info, Mint>>, 

    #[account(mut)]
    pub withdrawer_accrue_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub withdrawer_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,
}


pub fn handler(
    ctx: Context<WithdrawPool>, 
    atoken_amount: u64,  // withdrawer's accrue_mint amount
) -> Result<()> {
    let withdrawer = &ctx.accounts.withdrawer;
    let vault_info = &mut ctx.accounts.vault_info;
    let pool = &mut ctx.accounts.pool;
    let mint = &ctx.accounts.mint;
    let accrue_mint = &mut ctx.accounts.accrue_mint;
    let withdrawer_accrue_token_account = &mut ctx.accounts.withdrawer_accrue_token_account;
    let withdrawer_token_account = &mut ctx.accounts.withdrawer_token_account;
    let token_program = &ctx.accounts.token_program;
    let slot = ctx.accounts.clock.slot;

    // user actions disabled Check
    if vault_info.user_withdraws_disabled {
        return Err(error!(AccrueError::UserDepositWithdrawDisabledError));
    }

    // mint check
    if mint.key() != vault_info.mint {
        return Err(error!(AccrueError::VaultInfoMintMismatchError));
    }

    // withdrawer_accrue_token_account Checks
    if withdrawer_accrue_token_account.owner != withdrawer.key() {
        return Err(error!(AccrueError::AccrueTokenAccountOwnershipError));
    }

    if withdrawer_accrue_token_account.mint != vault_info.accrue_mint {
        return Err(error!(AccrueError::AccrueTokenAccountMintMismatchError));
    }

    // withdrawer_token_account Checks
    if withdrawer_token_account.owner != withdrawer.key() {
        return Err(error!(AccrueError::TokenAccountOwnershipError));
    }

    if withdrawer_token_account.mint != vault_info.mint {
        return Err(error!(AccrueError::TokenAccountMintMismatchError));
    }

    // amount Checks
    if atoken_amount == 0 {
        return Err(error!(AccrueError::WithdrawZeroError));
    }

    if atoken_amount > withdrawer_accrue_token_account.amount {
        return Err(error!(AccrueError::WithdrawInsufficientFundsError));
    }

    // update pool balance
    vault_info.pool.update_balance(slot, pool.amount);

    // get total balance if not stale
    let total_balance = vault_info.get_total_balance(slot)?;
    
    // interest fees update before
    vault_info.fees.update_interest_fee(
        total_balance
    )?;
    
    // Calculate mint amount that the user will get back: amount * total_balance / accrue_mint.supply
    let [pool_token_withdraw_amount, withdraw_fee] = Pool::calc_tokens_to_return(CalcTokensToReturnParams {
        withdraw_atoken_amount: atoken_amount,
        total_balance, 
        supply_before: accrue_mint.supply,
        fees: vault_info.fees,
    })?;
    vault_info.fees.collectible_fee = vault_info.fees.collectible_fee
        .checked_add(withdraw_fee)
        .ok_or(AccrueError::OverflowError)?;

    // Check if pool has enough funds to give to user
    if pool_token_withdraw_amount > vault_info.pool.get_balance(slot)? {
        return Err(error!(AccrueError::LocationInsufficientFundsError));
    }

    // Give them tokens
    anchor_spl::token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: pool.to_account_info(),
                to: withdrawer_token_account.to_account_info(),
                authority: pool.to_account_info(),
            },
            &[&[
                POOL_SEED, 
                vault_info.mint.as_ref(), 
                vault_info.vault_creator.as_ref(),
                &[vault_info.pool.bump]
            ]],
        ),
        pool_token_withdraw_amount,
    )?;

    // Burn their accrue tokens
    anchor_spl::token::burn(
        CpiContext::new(
            token_program.to_account_info(),
            Burn {
                mint: accrue_mint.to_account_info(),
                to: withdrawer_accrue_token_account.to_account_info(),
                authority: withdrawer.to_account_info(),
            },
        ),
        atoken_amount,
    )?;

    // NOTE: [All anchor Account<...> data passed to the above func] is invalid from this point. 
    // Must do .reload() before using again
    pool.reload()?;

    // update pool balance
    vault_info.pool.update_balance(
        slot, 
        pool.amount,
    );

    // update balance_estimate for next calculation
    vault_info.fees.balance_estimate = total_balance
        .checked_sub(pool_token_withdraw_amount)
        .ok_or(AccrueError::OverflowError)?;

    Ok(())
}