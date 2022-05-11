use anchor_lang::prelude::*;

pub mod errors;
pub mod vault;
pub mod pool;
pub mod protocols;

use vault::*;
use pool::*;
use protocols::*;

declare_id!("Cq66HoXPX5ECJeEB1zsxYLWs3F8SfG7D3B1S4vd8rAB5");


#[program]
mod autopilot {
    use super::*;


    /*  VAULT INSTRUCTIONS  */

    pub fn init_vault(
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
        vault::init_vault::handler(
            ctx, 
            client,
            vault_max,
            deposit_fee,
            withdraw_fee,
            interest_fee,
            protocols_max,
            cluster,
            version,
        )
    }

    pub fn change_vault_info(
        ctx: Context<ChangeVaultInfo>, 
        new_vault_max: u64,
        deposit_fee: u64,
        withdraw_fee: u64,
        interest_fee: u64,
        new_protocols_max: u8,
        new_version: u8,
        user_withdraws_disabled: bool,
    ) -> Result<()> {
        vault::change_vault_info::handler(
            ctx,
            new_vault_max,
            deposit_fee,
            withdraw_fee,
            interest_fee,
            new_protocols_max,
            new_version,
            user_withdraws_disabled,
        )
    }

    pub fn set_distribution(
        ctx: Context<SetDistribution>, 
        locations: Vec<[u8; 4]>,
        distribution: Vec<u64>,
        deposits_disabled: Vec<bool>,
    ) -> Result<()> {
        vault::set_distribution::handler(
            ctx,
            locations,
            distribution,
            deposits_disabled,
        )
    }

    pub fn collect_fees(
        ctx: Context<CollectFees>,
    ) -> Result<()> {
        vault::collect_fees::handler(
            ctx,
        )
    }

    /*  POOL INSTRUCTIONS  */

    pub fn deposit_pool(
        ctx: Context<DepositPool>, 
        deposit_amount: u64,
    ) -> Result<()> {
        pool::deposit_pool::handler(
            ctx, 
            deposit_amount,
        )
    }

    pub fn withdraw_pool(
        ctx: Context<WithdrawPool>, 
        atoken_amount: u64,  // withdrawer's accrue_mint amount
    ) -> Result<()> {
        pool::withdraw_pool::handler(
            ctx,
            atoken_amount,
        )
    }


    /*  SOLEND INSTRUCTIONS  */

    pub fn init_solend(
        ctx: Context<InitSolend>,
    ) -> Result<()> {
        solend::init_solend::handler(
            ctx,
        )
    }

    pub fn delete_solend(
        ctx: Context<DeleteSolend>, 
    ) -> Result<()> {
        solend::delete_solend::handler(
            ctx,
        )
    }

    pub fn get_balance_solend(
        ctx: Context<GetBalanceSolend>
    ) -> Result<()> {
        solend::get_balance_solend::handler(
            ctx,
        )
    }

    pub fn rebalance_solend(
        ctx: Context<RebalanceSolend>
    ) -> Result<()> {
        solend::rebalance_solend::handler(
            ctx,
        )
    }

    pub fn withdraw_solend(
        ctx: Context<WithdrawSolend>,
        atoken_amount: u64,  // withdrawer's accrue_mint amount
    ) -> Result<()> {
        solend::withdraw_solend::handler(
            ctx,
            atoken_amount,
        )
    }

    pub fn kill_solend(
        ctx: Context<KillSolend>,
    ) -> Result<()> {
        solend::kill_solend::handler(
            ctx,
        )
    }
}
