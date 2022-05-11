use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::errors::AccrueError;
use crate::vault::state::*;
use crate::protocols::protocol::*;
use super::utils::*;

/*
get_balance_solend

Get balance for this protocol, and update 
*/


#[derive(Accounts)]
pub struct GetBalanceSolend<'info> {
    #[account(mut)]
    pub vault_info: Box<Account<'info, VaultInfo>>,

    #[account(
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
    /// CHECK: expected_pyth_oracle
    pub pyth_oracle: AccountInfo<'info>,
    /// CHECK: expected_switchboard_oracle
    pub switchboard_oracle: AccountInfo<'info>,
    /// CHECK: get_program_id
    pub protocol_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handler(
    ctx: Context<GetBalanceSolend>, 
) -> Result<()> {
    let vault_info = &mut ctx.accounts.vault_info;
    let destination_collateral = &ctx.accounts.destination_collateral;
    let reserve = &mut ctx.accounts.reserve;
    let pyth_oracle = &ctx.accounts.pyth_oracle;
    let switchboard_oracle = &ctx.accounts.switchboard_oracle;
    let protocol_program = &ctx.accounts.protocol_program;
    let clock = &ctx.accounts.clock;

    // custom protocol logic: oracles & reserve
    let expected = get_mint(
        vault_info.cluster,
        vault_info.mint,
    )?;
    if pyth_oracle.key() != expected.pyth_oracle { 
        return Err(error!(AccrueError::ProtocolOracleMismatchError));
    };
    if switchboard_oracle.key() != expected.switchboard_oracle { 
        return Err(error!(AccrueError::ProtocolOracleMismatchError));
    };
    if reserve.key() != expected.reserve {
        return Err(error!(AccrueError::ProtocolReserveMismatchError));
    };

    // protocol program ID
    if protocol_program.key() != get_program_id(vault_info.cluster)? {
        return Err(error!(AccrueError::ProtocolProgramMismatchError));
    }

    // protocol exists
    let _ = vault_info.get_protocol(UUID.clone())?;

    // custom protocol logic: refresh reserve
    solend_refresh_reserve(
        get_program_id(vault_info.cluster)?,
        reserve.to_account_info(),
        pyth_oracle.to_account_info(),
        switchboard_oracle.to_account_info(),
        clock.to_account_info(),
    )?;
    // NOTE: [All anchor Account<...> data passed to the above func] is invalid from this point. 
    // Must do .reload() before using again
    
    // custom protocol logic: calculate current token balance
    let refreshed_reserve = unpack_reserve(&reserve)?;
    let token_balance = ctoken_to_token(
        &refreshed_reserve,
        destination_collateral.amount
    )?;

    // update balance
    vault_info
        .get_protocol_mut(UUID.clone())?
        .update_balance(clock.slot, token_balance);

    Ok(())
}