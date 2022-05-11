use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::errors::AccrueError;
use crate::vault::state::*;
use crate::protocols::protocol::*;
use crate::pool::pool::POOL_SEED;
use super::utils::*;
use crate::protocols::utils_spl::*;

/*
kill_solend

Move out all our funds out of this protocol without checking our pool or protocol balances
*/


#[derive(Accounts)]
pub struct KillSolend<'info> {
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
    ctx: Context<KillSolend>,
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

    // protocol balance is not stale
    let _ = protocol.get_balance(clock.slot)?;

    // withdrawing more than 0 ctokens. Use ctoken account directly instead of balance here
    // just in case protocol is returning the wrong balance
    if destination_collateral.amount == 0u64 {
        return Err(error!(AccrueError::KillNoBalanceError));
    }
    
    spl_withdraw(
        get_program_id(vault_info.cluster)?,
        destination_collateral.amount,
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
    destination_collateral.reload()?;

    // mark accounts as stale
    vault_info.get_protocol_mut(UUID.clone())?.last_update.mark_stale();
    vault_info.pool.last_update.mark_stale();  // must do this!! otherwise hacker can use outdated balance in same txn

    Ok(())
}
