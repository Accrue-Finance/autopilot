use anchor_lang::prelude::*;

use crate::{vault::VaultInfo, errors::AccrueError};

/*
change_vault_info

Modifies the VaultInfo account
*/

#[derive(Accounts)]
pub struct ChangeVaultInfo<'info> {
    #[account(mut)]
    pub vault_creator: Signer<'info>, 

    #[account(mut)]
    pub vault_info: Box<Account<'info, VaultInfo>>,
}


pub fn handler(
    ctx: Context<ChangeVaultInfo>,
    new_vault_max: u64,
    deposit_fee: u64,
    withdraw_fee: u64,
    interest_fee: u64,
    new_protocols_max: u8,
    new_version: u8,
    user_withdraws_disabled: bool,
) -> Result<()> {
    let vault_creator = &ctx.accounts.vault_creator;
    let vault_info = &mut ctx.accounts.vault_info;

    // vault ownership
    if vault_creator.key() != vault_info.vault_creator {
        return Err(error!(AccrueError::VaultCreatorOwnershipError));
    }

    vault_info.version = new_version;

    vault_info.protocols_max = new_protocols_max;
    vault_info.vault_max = new_vault_max;

    // fees
    vault_info.fees.deposit_fee = deposit_fee;
    vault_info.fees.withdraw_fee = withdraw_fee;
    vault_info.fees.interest_fee = interest_fee;

    // flags
    vault_info.user_withdraws_disabled = user_withdraws_disabled;

    Ok(())
}