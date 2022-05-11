use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount},
};

use crate::{vault::*, errors::AccrueError};
use crate::pool::pool::*;

/*
init_vault

Creates a new vault.
A public key can only have ONE vault per mint (i.e. user can only call init_vault once for USDT).
This entire smart contract basically relies on that fact.
*/

#[derive(Accounts)]
#[instruction(
    client: Pubkey,
    vault_max: u64,
    deposit_fee: u64,
    withdraw_fee: u64,
    interest_fee: u64,
    protocols_max: u8,
    cluster: u8,
    version: u8,
)]
pub struct InitVault<'info> {
    #[account(mut)]
    pub vault_creator: Signer<'info>, 

    #[account(
        init,
        payer = vault_creator,
        seeds = [b"vault_info", mint.key().as_ref(), vault_creator.key().as_ref()],
        bump,
        space = VaultInfo::size() as usize,
    )]
    pub vault_info: Box<Account<'info, VaultInfo>>,

    #[account(
        init, 
        payer = vault_creator,
        seeds = [POOL_SEED, mint.key().as_ref(), vault_creator.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = pool,
    )]
    pub pool: Box<Account<'info, TokenAccount>>,

    pub mint: Box<Account<'info, Mint>>,
    
    #[account(
        init,
        payer = vault_creator,
        seeds = [b"accrue_mint", mint.key().as_ref(), vault_creator.key().as_ref()],
        bump,
        mint::decimals = mint.decimals, 
        mint::authority = accrue_mint,  // owned by the PDA of the progran
        mint::freeze_authority = accrue_mint,  
    )]
    pub accrue_mint: Box<Account<'info, Mint>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}


pub fn handler(
    ctx: Context<InitVault>,
    client: Pubkey,
    vault_max: u64,
    deposit_fee: u64,
    withdraw_fee: u64,
    interest_fee: u64,
    protocols_max: u8,
    cluster: u8,
    version: u8,
) -> Result<()> {
    let vault_creator = &ctx.accounts.vault_creator;
    let vault_info = &mut ctx.accounts.vault_info;
    let mint = &ctx.accounts.mint;
    let accrue_mint = &ctx.accounts.accrue_mint;

    // cluster
    if cluster > 1u8 {
        return Err(error!(AccrueError::ProtocolClusterInvalidError));
    }

    if client != System::id() {
        return Err(error!(AccrueError::ClientAuthorityError));
    }

    vault_info.version = version;
    vault_info.cluster = cluster;   

    vault_info.vault_creator = vault_creator.key();
    vault_info.client = client;
    vault_info.protocols_max = protocols_max;
    vault_info.vault_max = vault_max;
    vault_info.mint = mint.key();
    vault_info.accrue_mint = accrue_mint.key();
    vault_info.accrue_mint_bump = *ctx.bumps.get("accrue_mint").unwrap();
    vault_info.vault_info_bump = *ctx.bumps.get("vault_info").unwrap();
    
    // pool
    vault_info.pool = Pool::new(*ctx.bumps.get("pool").unwrap());
    
    // protocols
    vault_info.protocols = vec![];

    // fees
    vault_info.fees.deposit_fee = deposit_fee;
    vault_info.fees.withdraw_fee = withdraw_fee;
    vault_info.fees.interest_fee = interest_fee;

    Ok(())
}