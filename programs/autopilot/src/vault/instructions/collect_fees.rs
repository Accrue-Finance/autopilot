use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Token};

use crate::{vault::VaultInfo, errors::AccrueError};
use crate::POOL_SEED;

/*
change_vault_info

Modifies the VaultInfo account
*/

#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(mut)]
    pub vault_creator: Signer<'info>, 

    #[account(mut)]
    pub vault_info: Box<Account<'info, VaultInfo>>,

    #[account(
        mut,
        seeds = [POOL_SEED, vault_info.mint.as_ref(), vault_info.vault_creator.as_ref()],
        bump = vault_info.pool.bump,
        // ^ make sure to use vault_info.* for seeds and bump so we check vault_info.pool == pool
    )]
    pub pool: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub fee_collection_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}


pub fn handler(
    ctx: Context<CollectFees>,
) -> Result<()> {
    let vault_creator = &ctx.accounts.vault_creator;
    let vault_info = &mut ctx.accounts.vault_info;
    let pool = &mut ctx.accounts.pool;
    let fee_collection_account = &mut ctx.accounts.fee_collection_account;
    let token_program = &ctx.accounts.token_program;
    let slot = ctx.accounts.clock.slot;

    // vault ownership
    if vault_creator.key() != vault_info.vault_creator {
        return Err(error!(AccrueError::VaultCreatorOwnershipError));
    }

    // update pool balance
    vault_info.pool.update_balance(slot, pool.amount);

    // get total balance if not stale
    let total_balance = vault_info.get_total_balance(slot)?;

    // interest fees update before
    vault_info.fees.update_interest_fee(
        total_balance
    )?;

    // token_withdraw_amount exceeds available
    if vault_info.fees.collectible_fee > pool.amount {
        return Err(error!(AccrueError::LocationInsufficientFundsError));
    }

    // Remove funds from the pool
    anchor_spl::token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: pool.to_account_info(),
                to: fee_collection_account.to_account_info(),
                authority: pool.to_account_info(),
            },
            &[&[
                POOL_SEED, 
                vault_info.mint.as_ref(), 
                vault_info.vault_creator.as_ref(),
                &[vault_info.pool.bump]
            ]],
        ),
        // The necessary amount was set by the offer maker.
        vault_info.fees.collectible_fee,
    )?;
    
    // NOTE: [All anchor Account<...> data passed to the above func] is invalid from this point. 
    // Must do .reload() before using again
    pool.reload()?;

    // update pool balance
    vault_info.pool.update_balance(
        slot, 
        pool.amount,
    );

    // interest fees update after
    vault_info.fees.balance_estimate = total_balance
        .checked_sub(vault_info.fees.collectible_fee)
        .ok_or(AccrueError::OverflowError)?;
    vault_info.fees.collectible_fee = 0u64;

    Ok(())
}