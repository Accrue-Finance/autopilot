use anchor_lang::prelude::*;
use solend_src::instruction::*;

// Deposit into an spl-lending reserve
pub fn spl_deposit<'a, 'b, 'c, 'info>(
    program_id: Pubkey,
    liquidity_amount: u64,
    source_liquidity: AccountInfo<'info>,
    destination_collateral: AccountInfo<'info>,
    reserve: AccountInfo<'info>,
    reserve_liquidity_supply: AccountInfo<'info>,
    reserve_collateral_mint: AccountInfo<'info>,
    lending_market: AccountInfo<'info>,
    lending_market_authority: AccountInfo<'info>,
    user_transfer_authority: AccountInfo<'info>,
    clock: AccountInfo<'info>,
    token: AccountInfo<'info>,
    signer_seeds: &'a [&'b [&'c [u8]]],
) -> Result<()> {
    let ix = deposit_reserve_liquidity(
        program_id,
        liquidity_amount,
        source_liquidity.key(),
        destination_collateral.key(),
        reserve.key(),
        reserve_liquidity_supply.key(),
        reserve_collateral_mint.key(),
        lending_market.key(),
        user_transfer_authority.key(),
    );

    anchor_lang::solana_program::program::invoke_signed(
        &ix, 
        &[
            source_liquidity,
            destination_collateral,
            reserve,
            reserve_liquidity_supply,
            reserve_collateral_mint,
            lending_market,
            lending_market_authority,
            user_transfer_authority,
            clock,
            token,
        ],
        signer_seeds,
    )?;

    Ok(())
}

// Withdraw from an spl-lending reserve
pub fn spl_withdraw<'a, 'b, 'c, 'info>(
    program_id: Pubkey,
    collateral_amount: u64,
    source_collateral: AccountInfo<'info>,
    destination_liquidity: AccountInfo<'info>,
    reserve: AccountInfo<'info>,
    reserve_collateral_mint: AccountInfo<'info>,
    reserve_liquidity_supply: AccountInfo<'info>,
    lending_market: AccountInfo<'info>,
    lending_market_authority: AccountInfo<'info>,
    user_transfer_authority: AccountInfo<'info>,
    clock: AccountInfo<'info>,
    token: AccountInfo<'info>,
    signer_seeds: &'a [&'b [&'c [u8]]],
) -> Result<()> {
    
    let ix = redeem_reserve_collateral(
        program_id,
        collateral_amount,
        source_collateral.key(),
        destination_liquidity.key(),
        reserve.key(),
        reserve_collateral_mint.key(),
        reserve_liquidity_supply.key(),
        lending_market.key(),
        user_transfer_authority.key(),
    );

    anchor_lang::solana_program::program::invoke_signed(
        &ix, 
        &[
            source_collateral,
            destination_liquidity,
            reserve,
            reserve_collateral_mint,
            reserve_liquidity_supply,
            lending_market,
            lending_market_authority,
            user_transfer_authority,
            clock,
            token,
        ],
        signer_seeds,
    )?;

    Ok(())
}