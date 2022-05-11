use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount};

use crate::{state::*, errors::AccrueError};
use super::pool::*;

/*
deposit_pool

Deposits user's funds into the pool.
*/

#[derive(Accounts)]
pub struct DepositPool<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>, 

    // Need to make sure that all other fields are from THIS VaultInfo account.
    #[account(mut)]
    pub vault_info: Box<Account<'info, VaultInfo>>,

    #[account(
        mut,
        seeds = [POOL_SEED, vault_info.mint.as_ref(), vault_info.vault_creator.as_ref()],
        bump = vault_info.pool.bump,
        // ^ make sure to use vault_info.* for seeds and bump so we check vault_info.pool == pool
    )]
    pub pool: Box<Account<'info, TokenAccount>>, 

    #[account(
        mut,
        seeds = [b"accrue_mint", vault_info.mint.as_ref(), vault_info.vault_creator.as_ref()],
        bump = vault_info.accrue_mint_bump,
        // ^ make sure to use vault_info.* for seeds and bump so we check vault_info.accrue_mint == accrue_mint
    )]
    pub accrue_mint: Box<Account<'info, Mint>>,
    
    #[account(mut)]
    pub depositor_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub depositor_accrue_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,
}


pub fn handler(
    ctx: Context<DepositPool>, 
    deposit_amount: u64,
) -> Result<()> {
    let depositor = &ctx.accounts.depositor;
    let vault_info = &mut ctx.accounts.vault_info;
    let pool = &mut ctx.accounts.pool;
    let accrue_mint = &mut ctx.accounts.accrue_mint;
    let depositor_token_account = &mut ctx.accounts.depositor_token_account;
    let depositor_accrue_token_account = &mut ctx.accounts.depositor_accrue_token_account;
    let token_program = &ctx.accounts.token_program;
    let slot = ctx.accounts.clock.slot;

    // depositor_token_account Checks
    if depositor_token_account.owner != depositor.key() {
        return Err(error!(AccrueError::TokenAccountOwnershipError));
    }

    if depositor_token_account.mint != vault_info.mint {
        return Err(error!(AccrueError::TokenAccountMintMismatchError));
    }

    // depositor_accrue_token_account Checks
    if depositor_accrue_token_account.owner != depositor.key() {
        return Err(error!(AccrueError::AccrueTokenAccountOwnershipError));
    }
    
    if depositor_accrue_token_account.mint != vault_info.accrue_mint {
        return Err(error!(AccrueError::AccrueTokenAccountMintMismatchError));
    }

    // Amount Checks
    if deposit_amount == 0 {
        return Err(error!(AccrueError::DepositZeroError));
    }
    
    if deposit_amount > depositor_token_account.amount {
        return Err(error!(AccrueError::DepositInsufficientFundsError));
    }

    // update pool balance
    vault_info.pool.update_balance(slot, pool.amount);

    // get total balance if not stale
    let total_balance = vault_info.get_total_balance(slot)?;

    // interest fees update before
    vault_info.fees.update_interest_fee(
        total_balance
    )?;

    // We can never actually have overflow here because 
    // curr pool amount + amount can never be greater than U64_MAX
    // because we checked that user actually has `amount` tokens in depositor_token_account.
    let new_pool_amount = total_balance.checked_add(
        deposit_amount
    ).ok_or(AccrueError::OverflowError)?;
    
    if new_pool_amount > vault_info.vault_max {
        return Err(error!(AccrueError::DepositVaultMaxError));
    }

    // Calculate the number of new aTokens to mint
    let [atokens, deposit_fee] = Pool::calc_atokens_to_mint(
        CalcAtokensToMintParams {
            deposit_token_amount: deposit_amount,   
            total_balance,
            supply_before: accrue_mint.supply,
            fees: vault_info.fees,
        }
    )?;
    vault_info.fees.collectible_fee = vault_info.fees.collectible_fee
        .checked_add(deposit_fee)
        .ok_or(AccrueError::OverflowError)?;

    if atokens == 0 {
        return Err(error!(AccrueError::DepositMinimumError));
    }

    // Transfer depositor Tokens into pool
    anchor_spl::token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: depositor_token_account.to_account_info(),
                to: pool.to_account_info(),
                authority: depositor.to_account_info(),
            },
        ),
        deposit_amount,
    )?;

    // Transfer aTokens to depositor
    anchor_spl::token::mint_to(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            MintTo {
                mint: accrue_mint.to_account_info(),
                to: depositor_accrue_token_account.to_account_info(),
                authority: accrue_mint.to_account_info(),
            },
            &[&[
                "accrue_mint".as_bytes(), 
                vault_info.mint.as_ref(), 
                vault_info.vault_creator.as_ref(),
                &[vault_info.accrue_mint_bump]
            ]],
        ),
        atokens,
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
        .checked_add(deposit_amount)
        .ok_or(AccrueError::OverflowError)?;

    Ok(())
}