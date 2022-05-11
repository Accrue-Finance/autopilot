use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::errors::AccrueError;
use crate::vault::state::*;
use crate::protocols::protocol::*;
use crate::pool::pool::POOL_SEED;
use super::utils::*;
use crate::protocols::utils_spl::*;

/*
rebalance_solend

Move our funds into this protocol from the pool, or withdraw the funds back into the pool
*/


#[derive(Accounts)]
pub struct RebalanceSolend<'info> {
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

    #[account(
        mut,
        seeds = [
            DEST_COLLATERAL_SEED,
            UUID, 
            vault_info.mint.as_ref(),
            vault_info.vault_creator.as_ref()
        ],
        bump = vault_info.get_protocol(UUID.clone())?.destination_collateral_bump.clone(),
    )]
    pub destination_collateral: Box<Account<'info, TokenAccount>>,
    /// CHECK: expected.reserve
    #[account(mut)]
    pub reserve: AccountInfo<'info>,
    /// CHECK: expected.reserve_liquidity_supply
    #[account(mut)]
    pub reserve_liquidity_supply: AccountInfo<'info>, 
    /// CHECK: expected.ctoken
    #[account(mut)]
    pub reserve_collateral_mint: AccountInfo<'info>,
    /// CHECK: expected_lending_market
    pub lending_market: AccountInfo<'info>,
    /// CHECK: expected_lending_market_auth
    pub lending_market_auth: AccountInfo<'info>,
    /// CHECK: get_program_id
    pub protocol_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handler(
    ctx: Context<RebalanceSolend>,
) -> Result<()> {
    let vault_creator = &ctx.accounts.vault_creator;
    let vault_info = &mut ctx.accounts.vault_info;
    let pool = &mut ctx.accounts.pool;
    let destination_collateral = &mut ctx.accounts.destination_collateral;
    let reserve = &mut ctx.accounts.reserve;
    let reserve_liquidity_supply = &mut ctx.accounts.reserve_liquidity_supply;
    let reserve_collateral_mint = &mut ctx.accounts.reserve_collateral_mint;
    let lending_market = &ctx.accounts.lending_market;
    let lending_market_auth = &ctx.accounts.lending_market_auth;
    let protocol_program = &ctx.accounts.protocol_program;
    let token_program = &ctx.accounts.token_program;
    let clock = &ctx.accounts.clock;

    // ownership check
    if vault_creator.key() != vault_info.vault_creator {
        return Err(error!(AccrueError::VaultCreatorOwnershipError));
    }

    // custom protocol logic: account checks
    let expected = get_mint(
        vault_info.cluster,
        vault_info.mint,
    )?;

    if reserve.key() != expected.reserve {
        return Err(error!(AccrueError::ProtocolReserveMismatchError));
    };
    if reserve_liquidity_supply.key() != expected.reserve_liquidity_supply {
        return Err(error!(AccrueError::ProtocolReserveLiqSupplyMismatchError));
    }
    if reserve_collateral_mint.key() != expected.ctoken {
        return Err(error!(AccrueError::ProtocolCMintMismatchError));
    }

    let expected_lending_market = get_lending_market(
        vault_info.cluster,
    )?;
    if lending_market.key() != expected_lending_market {
        return Err(error!(AccrueError::ProtocolLendingMarketMismatchError));
    }

    let expected_lending_market_auth = get_lending_market_auth(
        vault_info.cluster,
    )?;
    if lending_market_auth.key() != expected_lending_market_auth {
        return Err(error!(AccrueError::ProtocolLendingMarketAuthMismatchError));
    }

    let refreshed_reserve = unpack_reserve(&reserve)?;
    
    // protocol program ID
    if protocol_program.key() != get_program_id(vault_info.cluster)? {
        return Err(error!(AccrueError::ProtocolProgramMismatchError));
    }

    // update pool balance
    vault_info.pool.update_balance(
        clock.slot, 
        pool.amount,
    );
    
    // protocol exists
    let protocol = vault_info.get_protocol(UUID.clone())?;

    // all balances are updated, get balances
    let total_balance = vault_info.get_total_balance(clock.slot)?;
    let pool_balance_before = vault_info.pool.get_balance(clock.slot)?;
    let protocol_balance_before = protocol.get_balance(clock.slot)?;
    
    // calculate desired protocol balance
    let desired_protocol_balance = protocol.calc_desired_balance(&vault_info, total_balance)?;

    // deposit into protocol 
    if desired_protocol_balance > protocol_balance_before {  
        if protocol.deposits_disabled {
            return Err(error!(AccrueError::ProtocolDisabledError));
        }
        
        let desired_deposit_amount = desired_protocol_balance
            .checked_sub(protocol_balance_before)
            .ok_or(AccrueError::OverflowError)?;
        let actual_deposit_amount = desired_deposit_amount.min(pool_balance_before);

        spl_deposit(
            get_program_id(vault_info.cluster)?,
            actual_deposit_amount,
            pool.to_account_info(),
            destination_collateral.to_account_info(),
            reserve.to_account_info(),
            reserve_liquidity_supply.to_account_info(),
            reserve_collateral_mint.to_account_info(),
            lending_market.to_account_info(),
            lending_market_auth.to_account_info(),
            pool.to_account_info(),
            clock.to_account_info(),
            token_program.to_account_info(),
            &[&[
                POOL_SEED, 
                vault_info.mint.as_ref(), 
                vault_info.vault_creator.as_ref(),
                &[vault_info.pool.bump]
            ]],
        )?;
        // NOTE: [All anchor Account<...> data passed to the above func] is invalid from this point. 
        // Must do .reload() before using again
        
    // withdraw from protocol
    } else if desired_protocol_balance < protocol_balance_before {

        let actual_ctoken_withdraw_amount = if desired_protocol_balance == 0 {
            destination_collateral.amount  // withdraw all funds
        } else {
            let desired_withdraw_amount = protocol_balance_before
                .checked_sub(desired_protocol_balance)
                .ok_or(AccrueError::OverflowError)?;
            token_to_ctoken(&refreshed_reserve, desired_withdraw_amount)?
        };
        
        spl_withdraw(
            get_program_id(vault_info.cluster)?,
            actual_ctoken_withdraw_amount,
            destination_collateral.to_account_info(),
            pool.to_account_info(),
            reserve.to_account_info(),
            reserve_collateral_mint.to_account_info(),
            reserve_liquidity_supply.to_account_info(),
            lending_market.to_account_info(),
            lending_market_auth.to_account_info(),
            destination_collateral.to_account_info(),
            clock.to_account_info(),
            token_program.to_account_info(),
            &[&[
                DEST_COLLATERAL_SEED,
                UUID, 
                vault_info.mint.as_ref(),
                vault_info.vault_creator.as_ref(),
                &[protocol.destination_collateral_bump],
            ]],
        )?;
        // NOTE: [All anchor Account<...> data passed to the above func] is invalid from this point. 
        // Must do .reload() before using again
    }

    // mark accounts as stale
    // do NOT update reserve balance after the CPI -- it is stale!
    // also, our protocol_balance_after does NOT necessarily equal (protocol_balance_before + deposit_amount)
    // e.g. if we had 0 before, and we deposit 5, our balance actually might be 4 because protocols use `floor`.
    // So to be safe, just don't update the balances after we deposit/withdraw into protocols
    vault_info.get_protocol_mut(UUID.clone())?.last_update.mark_stale();
    vault_info.pool.last_update.mark_stale();

    Ok(())
}
