use anchor_lang::prelude::*;

#[error_code]
pub enum AccrueError {
    // General
    #[msg("Overflow in arithmetic operation")]
    OverflowError,

    // Locations (Pool or Protocols)
    #[msg("You need to refresh all the balances in one transaction")]
    LocationStaleError,

    #[msg("Location doesn't have that many tokens")]
    LocationInsufficientFundsError,

    // Protocols
    #[msg("Given uuid did not match a protocol in vault_info")]
    ProtocolUuidConversionError,

    #[msg("Protocol is disabled")]
    ProtocolDisabledError,

    #[msg("Protocol program id is wrong")]
    ProtocolProgramMismatchError,

    #[msg("Protocol already exists")]
    ProtocolAlreadyExists,

    #[msg("Protocol does not exist")]
    ProtocolDoesNotExist,

    #[msg("Invalid cluster provided")]
    ProtocolClusterInvalidError,

    #[msg("Maximum number of protocols has been reached")]
    ProtocolMaximumError,

    #[msg("Protocol still has balance")]
    ProtocolHasBalanceError,

    #[msg("Protocol distribution is not zero")]
    ProtocolDistributionNotZeroError,

    #[msg("Protocol mint does not exist")]
    ProtocolMintDNEError,

    #[msg("Protocol ctoken does not match")]
    ProtocolCMintMismatchError,

    #[msg("Protocol reserve does not match")]
    ProtocolReserveMismatchError,

    #[msg("protocol reserve liquidity supply does not match")]
    ProtocolReserveLiqSupplyMismatchError,

    #[msg("Protocol lending market does not match")]
    ProtocolLendingMarketMismatchError,

    #[msg("Protocol lending market auth does not match")]
    ProtocolLendingMarketAuthMismatchError,

    #[msg("Protocol oracle does not match")]
    ProtocolOracleMismatchError,

    // Instruction: General
    #[msg("You are not the creator of this vault")]
    VaultCreatorOwnershipError,

    #[msg("Mint != vault_info.mint")]
    VaultInfoMintMismatchError,

    #[msg("Accrue mint != vault_info.accrue_mint")]
    VaultInfoAccrueMintMismatchError,

    #[msg("You don't own that mint account")]
    TokenAccountOwnershipError,

    #[msg("Mint does not match vault_info")]
    TokenAccountMintMismatchError,

    #[msg("You don't own that accrue_mint account")]
    AccrueTokenAccountOwnershipError,

    #[msg("Accrue mint does not match vault_info")]
    AccrueTokenAccountMintMismatchError,

    #[msg("Client provided does not have authority over this vault")]
    ClientAuthorityError,

    // Instruction: Set Distribution
    #[msg("Array lengths were not expected")]
    SetDistributionLengthError,

    #[msg("Distribution does not sum to U64::MAX")]
    SetDistributionSumError,

    #[msg("uuid was provided multiple times")]
    SetDistributionDuplicateUuidError,

    #[msg("Location array is missing pool uuid")]
    SetDistributionMissingPoolError,

    // Instruction: Deposit
    #[msg("You can't deposit 0 coins!")]
    DepositZeroError,

    #[msg("You don't have enough funds to deposit that much")]
    DepositInsufficientFundsError,

    #[msg("Can't deposit that much. Exceeded vault maximum")]
    DepositVaultMaxError,

    #[msg("You must deposit enough tokens so at least one new token is minted")]
    DepositMinimumError,

    // Instruction: Withdraw
    #[msg("You can't withdraw 0 coins!")]
    WithdrawZeroError,

    #[msg("You don't have enough funds in the pool to withdraw that much")]
    WithdrawInsufficientFundsError,

    #[msg("You can't deposit or withdraw right now")]
    UserDepositWithdrawDisabledError,

    // Instruction: Kill
    #[msg("Kill can only be called if there is ctoken balance in the protocol")]
    KillNoBalanceError,
}

