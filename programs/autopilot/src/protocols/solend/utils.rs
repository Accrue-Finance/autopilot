use anchor_lang::prelude::*;
use solend_src::state::Reserve;
use solana_program::program_pack::Pack;
use solana_program::pubkey;

use crate::errors::AccrueError;
use crate::protocols::utils_mints::*;
use solend_src::instruction::refresh_reserve;

// UUID - Never change this once protocol is initialized
pub const UUID: &[u8; 4] = b"SLND";  

// PROGRAM ID
pub const PROGRAM_ID_MAINNET: Pubkey = pubkey!("So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo");
pub const PROGRAM_ID_DEVNET: Pubkey = pubkey!("ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx");

pub fn get_program_id(cluster: u8) -> Result<Pubkey> {
    match cluster {
        1u8 => Ok(PROGRAM_ID_MAINNET),
        0u8 => Ok(PROGRAM_ID_DEVNET),
        _ => Err(error!(AccrueError::ProtocolClusterInvalidError)),
    }
}

// LENDING_MARKET
pub const LENDING_MARKET_MAINNET: Pubkey = pubkey!("4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY");
pub const LENDING_MARKET_DEVNET: Pubkey = pubkey!("GvjoVKNjBvQcFaSKUW1gTE7DxhSpjHbE69umVR5nPuQp");

pub fn get_lending_market(cluster: u8) -> Result<Pubkey> {
    match cluster {
        1u8 => Ok(LENDING_MARKET_MAINNET),
        0u8 => Ok(LENDING_MARKET_DEVNET),
        _ => Err(error!(AccrueError::ProtocolClusterInvalidError)),
    }
}

// LENDING_MARKET_AUTH
pub const LENDING_MARKET_AUTH_MAINNET: Pubkey = pubkey!("DdZR6zRFiUt4S5mg7AV1uKB2z1f1WzcNYCaTEEWPAuby");
pub const LENDING_MARKET_AUTH_DEVNET: Pubkey = pubkey!("EhJ4fwaXUp7aiwvZThSUaGWCaBQAJe3AEaJJJVCn3UCK");

pub fn get_lending_market_auth(cluster: u8) -> Result<Pubkey> {
    match cluster {
        1u8 => Ok(LENDING_MARKET_AUTH_MAINNET),
        0u8 => Ok(LENDING_MARKET_AUTH_DEVNET),
        _ => Err(error!(AccrueError::ProtocolClusterInvalidError)),
    }
}

// MINTS & RESERVES
pub struct SolendMintInfo {
    pub address: Pubkey,
    pub pyth_oracle: Pubkey,
    pub switchboard_oracle: Pubkey,
    pub reserve: Pubkey,
    pub ctoken: Pubkey,
    pub reserve_liquidity_supply: Pubkey,
}

const M_SOL_MAINNET_PYTH_ORACLE: Pubkey = pubkey!("E4v1BBgoso9s64TQvmyownAVJbhbEPGyzA3qn4n46qj9");
const M_SOL_MAINNET_SWITCHBOARD_ORACLE: Pubkey = pubkey!("CEPVH2t11KS4CaL3w4YxT9tRiijoGA4VEbnQ97cEpDmQ");
const M_SOL_MAINNET_RESERVE: Pubkey = pubkey!("CCpirWrgNuBVLdkP2haxLTbD6XqEgaYuVXixbbpxUB6");
const M_SOL_MAINNET_CTOKEN: Pubkey = pubkey!("3JFC4cB56Er45nWVe29Bhnn5GnwQzSmHVf6eUq9ac91h");
const M_SOL_MAINNET_RESERVE_LIQ_SUPPLY: Pubkey = pubkey!("3R5SVe3qABRUYozgeMNVkSotVoa4HhTFFgWgx2G2QMov");

const RAY_MAINNET_PYTH_ORACLE: Pubkey = pubkey!("AnLf8tVYCM816gmBjiy8n53eXKKEDydT5piYjjQDPgTB");
const RAY_MAINNET_SWITCHBOARD_ORACLE: Pubkey = pubkey!("CppyF6264uKZkGua1brTUa2fSVdMFSCszwzDs76HCuzU");
const RAY_MAINNET_RESERVE: Pubkey = pubkey!("9n2exoMQwMTzfw6NFoFFujxYPndWVLtKREJePssrKb36");
const RAY_MAINNET_CTOKEN: Pubkey = pubkey!("2d95ZC8L5XP6xCnaKx8D5U5eX6rKbboBBAwuBLxaFmmJ");
const RAY_MAINNET_RESERVE_LIQ_SUPPLY: Pubkey = pubkey!("5JT6EK5wLEYGpAXMY2BXvhoeuQCp93eo4os2EtXwnPG1");

const SOL_MAINNET_PYTH_ORACLE: Pubkey = pubkey!("H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG");
const SOL_MAINNET_SWITCHBOARD_ORACLE: Pubkey = pubkey!("AdtRGGhmqvom3Jemp5YNrxd9q9unX36BZk1pujkkXijL");
const SOL_MAINNET_RESERVE: Pubkey = pubkey!("8PbodeaosQP19SjYFx855UMqWxH2HynZLdBXmsrbac36");
const SOL_MAINNET_CTOKEN: Pubkey = pubkey!("5h6ssFpeDeRbzsEHDbTQNH7nVGgsKrZydxdSTnLm6QdV");
const SOL_MAINNET_RESERVE_LIQ_SUPPLY: Pubkey = pubkey!("8UviNr47S8eL6J3WfDxMRa3hvLta1VDJwNWqsDgtN3Cv");

const USDC_MAINNET_PYTH_ORACLE: Pubkey = pubkey!("Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD");
const USDC_MAINNET_SWITCHBOARD_ORACLE: Pubkey = pubkey!("CZx29wKMUxaJDq6aLVQTdViPL754tTR64NAgQBUGxxHb");
const USDC_MAINNET_RESERVE: Pubkey = pubkey!("BgxfHJDzm44T7XG68MYKx7YisTjZu73tVovyZSjJMpmw");
const USDC_MAINNET_CTOKEN: Pubkey = pubkey!("993dVFL2uXWYeoXuEBFXR4BijeXdTv4s6BzsCjJZuwqk");
const USDC_MAINNET_RESERVE_LIQ_SUPPLY: Pubkey = pubkey!("8SheGtsopRUDzdiD6v6BR9a6bqZ9QwywYQY99Fp5meNf");

const USDT_MAINNET_PYTH_ORACLE: Pubkey = pubkey!("3vxLXJqLqF3JG5TCbYycbKWRBbCJQLxQmBGCkyqEEefL");
const USDT_MAINNET_SWITCHBOARD_ORACLE: Pubkey = pubkey!("5mp8kbkTYwWWCsKSte8rURjTuyinsqBpJ9xAQsewPDD");
const USDT_MAINNET_RESERVE: Pubkey = pubkey!("8K9WC8xoh2rtQNY7iEGXtPvfbDCi563SdWhCAhuMP2xE");
const USDT_MAINNET_CTOKEN: Pubkey = pubkey!("BTsbZDV7aCMRJ3VNy9ygV4Q2UeEo9GpR8D6VvmMZzNr8");
const USDT_MAINNET_RESERVE_LIQ_SUPPLY: Pubkey = pubkey!("3CdpSW5dxM7RTxBgxeyt8nnnjqoDbZe48tsBs9QUrmuN");

const BTC_MAINNET_PYTH_ORACLE: Pubkey = pubkey!("GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU");
const BTC_MAINNET_SWITCHBOARD_ORACLE: Pubkey = pubkey!("74YzQPGUT9VnjrBz8MuyDLKgKpbDqGot5xZJvTtMi6Ng");
const BTC_MAINNET_RESERVE: Pubkey = pubkey!("GYzjMCXTDue12eUGKKWAqtF5jcBYNmewr6Db6LaguEaX");
const BTC_MAINNET_CTOKEN: Pubkey = pubkey!("Gqu3TFmJXfnfSX84kqbZ5u9JjSBVoesaHjfTsaPjRSnZ");
const BTC_MAINNET_RESERVE_LIQ_SUPPLY: Pubkey = pubkey!("4jkyJVWQm8NUkiJFJQx6ZJQhfKLGpeZsNrXoT4bAPrRv");

const SOL_DEVNET_PYTH_ORACLE: Pubkey = pubkey!("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");
const SOL_DEVNET_SWITCHBOARD_ORACLE: Pubkey = pubkey!("AdtRGGhmqvom3Jemp5YNrxd9q9unX36BZk1pujkkXijL");
const SOL_DEVNET_RESERVE: Pubkey = pubkey!("5VVLD7BQp8y3bTgyF5ezm1ResyMTR3PhYsT4iHFU8Sxz");
const SOL_DEVNET_CTOKEN: Pubkey = pubkey!("FzwZWRMc3GCqjSrcpVX3ueJc6UpcV6iWWb7ZMsTXE3Gf");
const SOL_DEVNET_RESERVE_LIQ_SUPPLY: Pubkey = pubkey!("furd3XUtjXZ2gRvSsoUts9A5m8cMJNqdsyR2Rt8vY9s");

const USDC_DEVNET_RESERVE: Pubkey = pubkey!("FNNkz4RCQezSSS71rW2tvqZH1LCkTzaiG7Nd1LeA5x5y");
const USDC_DEVNET_CTOKEN: Pubkey = pubkey!("E2PSSXsXJGdpqhhaV3rYPpuy1inRCQAWxcdykA1DTmYr");
const USDC_DEVNET_RESERVE_LIQ_SUPPLY: Pubkey = pubkey!("HixjFJoeD2ggqKgFHQxrcJFjVvE5nXKuUPYNijFg7Kc5");


pub fn get_mint<'info>(cluster: u8, mint: Pubkey) -> Result<SolendMintInfo> {
    match cluster {
        1u8 => {
            if mint.eq(&M_SOL_MAINNET) {
                Ok(SolendMintInfo {
                    address: M_SOL_MAINNET,
                    pyth_oracle: M_SOL_MAINNET_PYTH_ORACLE,
                    switchboard_oracle: M_SOL_MAINNET_SWITCHBOARD_ORACLE,
                    reserve: M_SOL_MAINNET_RESERVE,
                    ctoken: M_SOL_MAINNET_CTOKEN,
                    reserve_liquidity_supply: M_SOL_MAINNET_RESERVE_LIQ_SUPPLY,
                })
            } else if mint.eq(&RAY_MAINNET) {
                Ok(SolendMintInfo {
                    address: RAY_MAINNET,
                    pyth_oracle: RAY_MAINNET_PYTH_ORACLE,
                    switchboard_oracle: RAY_MAINNET_SWITCHBOARD_ORACLE,
                    reserve: RAY_MAINNET_RESERVE,
                    ctoken: RAY_MAINNET_CTOKEN,
                    reserve_liquidity_supply: RAY_MAINNET_RESERVE_LIQ_SUPPLY,
                })
            } else if mint.eq(&SOL_MAINNET) {
                Ok(SolendMintInfo {
                    address: SOL_MAINNET,
                    pyth_oracle: SOL_MAINNET_PYTH_ORACLE,
                    switchboard_oracle: SOL_MAINNET_SWITCHBOARD_ORACLE,
                    reserve: SOL_MAINNET_RESERVE,
                    ctoken: SOL_MAINNET_CTOKEN,
                    reserve_liquidity_supply: SOL_MAINNET_RESERVE_LIQ_SUPPLY,
                })
            } else if mint.eq(&USDC_MAINNET) {
                Ok(SolendMintInfo {
                    address: USDC_MAINNET,
                    pyth_oracle: USDC_MAINNET_PYTH_ORACLE,
                    switchboard_oracle: USDC_MAINNET_SWITCHBOARD_ORACLE,
                    reserve: USDC_MAINNET_RESERVE,
                    ctoken: USDC_MAINNET_CTOKEN,
                    reserve_liquidity_supply: USDC_MAINNET_RESERVE_LIQ_SUPPLY,
                })
            } else if mint.eq(&USDT_MAINNET) {
                Ok(SolendMintInfo {
                    address: USDT_MAINNET,
                    pyth_oracle: USDT_MAINNET_PYTH_ORACLE,
                    switchboard_oracle: USDT_MAINNET_SWITCHBOARD_ORACLE,
                    reserve: USDT_MAINNET_RESERVE,
                    ctoken: USDT_MAINNET_CTOKEN,
                    reserve_liquidity_supply: USDT_MAINNET_RESERVE_LIQ_SUPPLY,
                })
            } else if mint.eq(&BTC_MAINNET) {
                Ok(SolendMintInfo {
                    address: BTC_MAINNET,
                    pyth_oracle: BTC_MAINNET_PYTH_ORACLE,
                    switchboard_oracle: BTC_MAINNET_SWITCHBOARD_ORACLE,
                    reserve: BTC_MAINNET_RESERVE,
                    ctoken: BTC_MAINNET_CTOKEN,
                    reserve_liquidity_supply: BTC_MAINNET_RESERVE_LIQ_SUPPLY,
                })
            } else { Err(error!(AccrueError::ProtocolMintDNEError)) }
        },
        0u8 => {
            if mint.eq(&SOL_DEVNET) {
                Ok(SolendMintInfo {
                    address: SOL_DEVNET,
                    pyth_oracle: SOL_DEVNET_PYTH_ORACLE,
                    switchboard_oracle: SOL_DEVNET_SWITCHBOARD_ORACLE,
                    reserve: SOL_DEVNET_RESERVE,
                    ctoken: SOL_DEVNET_CTOKEN,
                    reserve_liquidity_supply: SOL_DEVNET_RESERVE_LIQ_SUPPLY,
                })
            } else if mint.eq(&USDC_DEVNET) {
                Ok(SolendMintInfo {
                    address: USDC_DEVNET,
                    pyth_oracle: SOL_DEVNET_PYTH_ORACLE,
                    switchboard_oracle: SOL_DEVNET_SWITCHBOARD_ORACLE,
                    reserve: USDC_DEVNET_RESERVE,
                    ctoken: USDC_DEVNET_CTOKEN,
                    reserve_liquidity_supply: USDC_DEVNET_RESERVE_LIQ_SUPPLY,
                })
            } else { Err(error!(AccrueError::ProtocolMintDNEError)) }
        },
        _ => Err(error!(AccrueError::ProtocolClusterInvalidError)),
    }
}


// FUNCTIONS
pub fn unpack_reserve<'info>(reserve: &AccountInfo<'info>) -> Result<Reserve> {
    let reserve = Reserve::unpack(
        &reserve.to_account_info().data.borrow()
    )?;
    Ok(reserve)
}

pub fn ctoken_to_token(refreshed_reserve: &Reserve, ctoken_amount: u64) -> Result<u64> {
    if ctoken_amount == 0u64 {
        return Ok(0u64);
    } else {
        let token_amount = refreshed_reserve
            .collateral_exchange_rate()?
            .collateral_to_liquidity(ctoken_amount)?;
        return Ok(token_amount);
    }
}

/*
Beware when using this function! token_amount != token_to_ctoken(ctoken_to_token(token_amount));
Say token_amount = 4. Doing token_to_ctoken(..., token_amount) returns 3 ctokens, 
and then doing ctoken_to_token(3) returns 3 tokens! This has to do with flooring.
*/
pub fn token_to_ctoken(refreshed_reserve: &Reserve, token_amount: u64) -> Result<u64> {
    if token_amount == 0u64 {
        return Ok(0u64);
    } else {
        let ctoken_amount = refreshed_reserve
            .collateral_exchange_rate()?
            .liquidity_to_collateral(token_amount)?;
        return Ok(ctoken_amount);
    }
}


// INSTRUCTIONS
pub fn solend_refresh_reserve<'a>(
    program_id: Pubkey,
    reserve: AccountInfo<'a>,
    pyth_oracle: AccountInfo<'a>,
    switchboard_oracle: AccountInfo<'a>,
    clock: AccountInfo<'a>,
) -> Result<()> {
    let ix = refresh_reserve(
        program_id,
        reserve.key(),
        pyth_oracle.key(),
        switchboard_oracle.key(),
    );

    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            reserve,
            pyth_oracle,
            switchboard_oracle,
            clock,
        ], 
    )?;

    Ok(())
}


/*

MAINNET

Reserves
SOL
8PbodeaosQP19SjYFx855UMqWxH2HynZLdBXmsrbac36
USDC
BgxfHJDzm44T7XG68MYKx7YisTjZu73tVovyZSjJMpmw
soETH (Sollet)
3PArRsZQ6SLkr1WERZWyC6AqsajtALMq4C66ZMYz4dKQ
BTC (Sollet)
GYzjMCXTDue12eUGKKWAqtF5jcBYNmewr6Db6LaguEaX
SRM
5suXmvdbKQ98VonxGCXqViuWRu8k4zgZRxndYKsH2fJg
USDT
8K9WC8xoh2rtQNY7iEGXtPvfbDCi563SdWhCAhuMP2xE
soFTT (Sollet)
2dC4V23zJxuv521iYQj8c471jrxYLNQFaGS6YPwtTHMd
RAY
9n2exoMQwMTzfw6NFoFFujxYPndWVLtKREJePssrKb36
SBR
Hthrt4Lab21Yz1Dx9Q4sFW4WVihdBUTtWRQBjPsYHCor
MER
5Sb6wDpweg6mtYksPJ2pfGbSyikrhR8Ut8GszcULQ83A
mSOL
CCpirWrgNuBVLdkP2haxLTbD6XqEgaYuVXixbbpxUB6
ETH (Wormhole)
CPDiKagfozERtJ33p7HHhEfJERjvfk1VAjMXAFLrvrKP
SLND
CviGNzD2C9ZCMmjDt5DKCce5cLV4Emrcm3NFvwudBFKA
scnSOL
DUExYJG5sc1SQdMMdq6LdUYW9ULXbo2fFFTbedywgjNN
stSOL
5sjkv6HD8wycocJ4tC4U36HHbvgcXYqcyiPRUkncnwWs
UST (Wormhole)
Ab48bKsiEzdm481mGaNVmv9m9DmXsWWxcYHM588M59Yd
FTT (Wormhole)
8bDyV3N7ctLKoaSVqUoEwUzw6msS2F65yyNPgAVUisKm


DEVNET
SOL
5VVLD7BQp8y3bTgyF5ezm1ResyMTR3PhYsT4iHFU8Sxz
USDC
FNNkz4RCQezSSS71rW2tvqZH1LCkTzaiG7Nd1LeA5x5y
ETH
CuQcLfN3iTWqyEEbAHNZp7awChbR4KQPFJsTUhsAxrcu
BTC
FNXBRv3saDgVoaoDLV5ho28D4AvZikG9r7QpThTLak9f
SRM
5YKmMZcuWEdF5NavNK4MgKPRhnhw6jq22zwcdh1dvxbd
USDT
ERm3jhg8J94hxr7KmhkRvnuYbKZgNFEL4hXzBMeb1rQ8
soFTT
8eUYeEiGXRMN7V9Xx7CehwSRfJB9iQfJW249zX1z7Uue
RAY
FpKhrtU6nDjEcAi3SsSevRRgPzirLkZpmXD6nfeb7k8c
SBR
5CXDzn4AygQwu59fGxo34T965BmYMHuGvAuoRMeRBKg4
MER
HbXi7Gpe5GXzE7V1SjEEy3sDurmFi7RbTvCZ3Rd7Nv6b
mSOL
Ei2dC7hFxBhVq5pn4qNJLMxKBSojx7p7wnNoBz4HELKG

*/