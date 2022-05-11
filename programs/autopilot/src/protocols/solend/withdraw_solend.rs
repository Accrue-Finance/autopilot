use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Burn, Mint};

use crate::errors::AccrueError;
use crate::pool::{Pool, CalcTokensToReturnParams};
use crate::vault::state::*;
use crate::protocols::protocol::*;
use crate::pool::pool::POOL_SEED;
use super::utils::*;
use crate::protocols::utils_spl::*;

/*
withdraw_solend

Let the user directly remove their tokens from this protocol
*/


#[derive(Accounts)]
pub struct WithdrawSolend<'info> {
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
    ctx: Context<WithdrawSolend>,
    atoken_amount: u64,  // withdrawer's accrue_mint amount
) -> Result<()> {
    let withdrawer = &ctx.accounts.withdrawer;
    let vault_info = &mut ctx.accounts.vault_info;
    let pool = &mut ctx.accounts.pool;
    let mint = &ctx.accounts.mint;
    let accrue_mint = &mut ctx.accounts.accrue_mint;
    let withdrawer_accrue_token_account = &mut ctx.accounts.withdrawer_accrue_token_account;
    let withdrawer_token_account = &mut ctx.accounts.withdrawer_token_account;
    let destination_collateral = &mut ctx.accounts.destination_collateral;
    let reserve = &mut ctx.accounts.reserve;
    let reserve_liquidity_supply = &mut ctx.accounts.reserve_liquidity_supply;
    let reserve_collateral_mint = &mut ctx.accounts.reserve_collateral_mint;
    let lending_market = &ctx.accounts.lending_market;
    let lending_market_auth = &ctx.accounts.lending_market_auth;
    let protocol_program = &ctx.accounts.protocol_program;
    let token_program = &ctx.accounts.token_program;
    let clock = &ctx.accounts.clock;

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

    // update pool balance. We don't use pool for this txn, but need up-to-date balance for get_total_balance()
    vault_info.pool.update_balance(
        clock.slot, 
        pool.amount,
    );

    // all balances are updated, get balances
    let total_balance = vault_info.get_total_balance(clock.slot)?;

    // interest fees update before
    vault_info.fees.update_interest_fee(
        total_balance
    )?;

    // Calculate mint amount that the user will get back: amount * total_balance / accrue_mint.supply
    let [token_withdraw_amount, withdraw_fee] = Pool::calc_tokens_to_return(CalcTokensToReturnParams {
        withdraw_atoken_amount: atoken_amount,
        total_balance, 
        supply_before: accrue_mint.supply,
        fees: vault_info.fees,
    })?;
    vault_info.fees.collectible_fee = vault_info.fees.collectible_fee
        .checked_add(withdraw_fee)
        .ok_or(AccrueError::OverflowError)?;

    // protocol exists
    let protocol = vault_info.get_protocol(UUID.clone())?;
    let protocol_balance_before = protocol.get_balance(clock.slot)?;

    // Check if protocol has enough funds to give to user
    if token_withdraw_amount > protocol_balance_before {
        return Err(error!(AccrueError::LocationInsufficientFundsError));
    }

    // Calculate ctokens to withdraw
    let ctoken_withdraw_amount = if token_withdraw_amount == protocol_balance_before {
        destination_collateral.amount  // withdraw all funds
    } else {
        token_to_ctoken(&refreshed_reserve, token_withdraw_amount)?
    };

    // Calculate estimated number of tokens we expect to withdraw. Used for fee calculation
    let estimated_token_withdraw_amount = ctoken_to_token(&refreshed_reserve, ctoken_withdraw_amount)?;

    // Withdraw ctokens and give tokens to user
    spl_withdraw(
        get_program_id(vault_info.cluster)?,
        ctoken_withdraw_amount,
        destination_collateral.to_account_info(),
        withdrawer_token_account.to_account_info(),  // withdrawer token account
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
    // Must do .() before using again

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

    // mark accounts as stale
    // do NOT update reserve balance after the CPI -- it is stale!
    // also, our protocol_balance_after does NOT necessarily equal (protocol_balance_before + deposit_amount)
    // e.g. if we had 0 before, and we deposit 5, our balance actually might be 4 because protocols use `floor`.
    // So to be safe, just don't update the balances after we deposit/withdraw into protocols
    vault_info.get_protocol_mut(UUID.clone())?.last_update.mark_stale();

    // update balance_estimate for next calculation
    vault_info.fees.balance_estimate = total_balance
        .checked_sub(estimated_token_withdraw_amount)
        .ok_or(AccrueError::OverflowError)?;

    Ok(())
}