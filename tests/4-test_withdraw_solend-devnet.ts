// import * as anchor from "@project-serum/anchor";
// import * as spl from "@solana/spl-token";
// import _ from "lodash";
// import * as chai from "chai";
// import * as chaiAsPromised from "chai-as-promised";
// import * as u from "./general/utils";
// import { Mint, User, Vault } from "./vault/classes";
// import { changeVaultInfo, initVault, setDistribution, setDistributionInstr } from "./vault/instructions";
// import { depositPoolInstr, withdrawPoolInstr } from "./pool/instructions";
// import * as instr from "./protocols/solend/instructions";
// import {
//   assertSimulationError,
// } from "./general/utils";
// import {
//   SolendProtocol,
//   SOLEND_UUID,
//   SOLEND_ACCOUNTS,
// } from "./protocols/solend/classes";
// import { SOL_DEVNET, USDC_DEVNET } from "./general/accounts";
// import { Autopilot } from "../target/types/autopilot";
// const { assert } = chai;
// chai.use(chaiAsPromised.default);

// const UUID = SOLEND_UUID;

// describe("withdraw_solend", () => {
//   anchor.setProvider(anchor.Provider.env());
//   const program = anchor.workspace.Autopilot as anchor.Program<Autopilot>;
//   const connection = anchor.getProvider().connection;
//   const accrueErrors = {}
//   program.idl.errors.forEach(error => {
//     const errorName = error["name"];
//     accrueErrors[errorName] = error["code"];
//   });

//   // NOTE: The mints / vaults / users used here are different than test_vault and test_pool
//   const mintCreator = new User(); // doesnt need spl tokens so don't pass in mint
//   const vaultCreator = new User(null, new anchor.BN(1000), new anchor.BN(1));

//   // Mint 1: Has no possibility of reaching vault max or overflow, so we can assign tokens carelessly to all accounts
//   // Make sure to use low numbers so we never run into supply max problem!
//   // Vault max should be far greater than users' token acc balances, which should be far greater than users' deposit amounts
//   const mint1 = Mint.createExisting(
//     program,
//     connection,
//     SOL_DEVNET,
//     u.god.mintTokenAccount,
//     u.god.keypair
//   );
//   const vault1 = new Vault(mint1, vaultCreator, u.bn(1e6));
//   vaultCreator.vault = vault1; // vaultCreator creates vault1 and vault2, but set vaultCreator's default params to vault1
//   const citizen1 = new User(
//     vault1,
//     new anchor.BN(1000), // originalMintAmount
//     new anchor.BN(11) // depositAmount
//   );
//   const hacker1 = new User(
//     vault1,
//     new anchor.BN(1000), // originalMintAmount
//     new anchor.BN(7) // depositAmount
//   );

//   const hacker1OwnedVault = new Vault(mint1, hacker1, u.bn(1e6));
//   // ^ This is just an extra vault with the same mint as vault1, but with hacker1 as the owner
//   //   hacker1.vault should NOT change to hacker1OwnedVault.

//   // DIFF: Mint 2
//   const mint2 = Mint.createExisting(
//     program,
//     connection,
//     USDC_DEVNET,
//     // u.god.mintTokenAccount, cant fund the account with USDC
//     // u.god.keypair,
//   );
//   const vault2 = new Vault(
//     mint2,
//     vaultCreator,
//     u.U64_MAX.sub(new anchor.BN(100000))
//   );
//   // ^ vault2 MUST be created by vault1.vaultCreator. Tests rely on that fact
//   const hacker2 = new User(
//     vault2,
//     // u.bn(0),
//     // u.bn(0),
//     u.U64_MAX.sub(new anchor.BN(1)),  // originalMintAmount - cant fund the account with USDC
//     u.U64_MAX.div(new anchor.BN(3))   // depositAmount
//   );
//   const citizen2 = new User(
//     vault2,
//     u.bn(0), //   new anchor.BN(1),  // originalMintAmount
//     u.bn(0) //   new anchor.BN(1)   // depositAmount
//   );

//   let hacker1Vault2AccrueTokenAccount: anchor.web3.PublicKey; // hacker1's accrue mint account for vault2

//   const users = [
//     mintCreator,
//     vaultCreator,
//     citizen1,
//     hacker1,
//     hacker2,
//     citizen2,
//   ];

//   const mints = [mint1, mint2];

//   const vaults = [vault1, hacker1OwnedVault, vault2];

//   before(async () => {
//     // Airdrop Lamports
//     await u.bulkAirdrop(connection, users);

//     // Create Mints, Token Accounts, and Vaults
//     await Promise.all(mints.map((mint) => mint.initialize()));
//     await Promise.all(users.map((user) => user.initialize()));
//     await Promise.all(vaults.map((vault) => vault.initialize()));

//     // Initialize Vaults (and create accrue_mints)
//     await Promise.all(vaults.map((v) => initVault(v)));

//     // Create users' accrue mint token accounts
//     await Promise.all(users.map((user) => user.initializeAccrueTokenAccount()));

//     // Accrue token account for hacker1 for vault2
//     hacker1Vault2AccrueTokenAccount = (
//       await vault2.accrueMint.getOrCreateAssociatedAccountInfo(
//         hacker1.publicKey
//       )
//     ).address;

//     // DIFF: Initialize Solend for all vaults
//     for (let i = 0; i < vaults.length; i++) {
//       const solend = new SolendProtocol(vaults[i], program, connection);
//       await solend.initialize(program);
//       vaults[i].protocols.push(solend);
//     }

//     // DIFF: initSolend for all vaults
//     await Promise.all(vaults.map((v) => instr.initSolend(v)));

//     // DIFF: Preparation. 0-100 set_distribution, citizen1 deposit_pool, rebalance_solend
//     vault1.pool.distribution = u.bn(0);
//     vault1.protocols[0].distribution = u.U64_MAX;
//     const txn = new anchor.web3.Transaction();
//     txn.add(setDistributionInstr(vault1));
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(depositPoolInstr(citizen1));
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.rebalanceSolendInstr(vault1));
//     await program.provider.send(txn, [vault1.vaultCreator.keypair, citizen1.keypair]);
//   });

//   /************************************************************



//   WITHDRAW_SOLEND



//   *************************************************************/

//   it('WithdrawSolend: Failure: Constraint: withdrawer did not sign the txn', async () => {
//     // No signers
//     await chai.expect(
//       // NOTE: not a simulation because `simulate` doesn't check signers
//       instr.withdrawSolend(hacker1, {
//         signers: []
//       })
//     ).to.be.rejectedWith("Signature verification failed");

//     // Wrong signer
//     await chai.expect(
//       // NOTE: not a simulation because `simulate` doesn't check signers
//       instr.withdrawSolend(citizen1, {
//         signers: [hacker1.keypair]
//       })
//     ).to.be.rejectedWith(`unknown signer: ${hacker1.publicKey}`);
//   });

//   it('WithdrawSolend: Failure: Constraint: vault_info is not owned by program', async () => {
//     const res = await instr.withdrawSolend(hacker1, {
//       vaultInfo: hacker1.mintTokenAccount,
//     }, true);
//     u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('WithdrawSolend: Failure: Constraint: pool is not owned by program', async () => {
//     const res = await instr.withdrawSolend(hacker1, {
//       pool: hacker1.publicKey,
//     }, true);
//     u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('WithdrawSolend: Failure: Constraint: pool has wrong creator or mint', async () => {
//     // wrong mint
//     const res1 = await instr.withdrawSolend(hacker1, {
//       pool: vault2.pool.publicKey,
//     }, true);
//     u.assertSimulationError(res1, [2006]);  // ConstraintSeeds

//     // wrong vault_creator
//     const res2 = await instr.withdrawSolend(hacker1, {
//       pool: hacker1OwnedVault.pool.publicKey,
//     }, true);
//     u.assertSimulationError(res2, [2006]);  // ConstraintSeeds
//   });

//   it('WithdrawSolend: Failure: Constraint: mint is not owned by token program', async () => {
//     const res = await instr.withdrawSolend(hacker1, {
//       mint: hacker1.publicKey,
//     }, true);
//     u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('WithdrawSolend: Failure: Constraint: accrue_mint has wrong mint or vault_creator', async () => {
//     // wrong mint
//     const res1 = await instr.withdrawSolend(hacker1, {
//       accrueMint: vault2.accrueMint.publicKey
//     }, true);
//     u.assertSimulationError(res1, [2006]);  // ConstraintSeeds

//     // wrong vault_creator
//     const res2 = await instr.withdrawSolend(hacker1, {
//       accrueMint: hacker1OwnedVault.accrueMint.publicKey
//     }, true);
//     u.assertSimulationError(res2, [2006]);  // ConstraintSeeds
//   });

//   it('WithdrawSolend: Failure: Constraint: withdrawer_accrue_token_account is not owned by token program', async () => {
//     // wrong mint
//     const res = await instr.withdrawSolend(hacker1, {
//       withdrawerAccrueTokenAccount: hacker1.publicKey,
//     }, true);
//     u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('WithdrawSolend: Failure: Constraint: withdrawer_token_account is not owned by token program', async () => {
//     // wrong mint
//     const res = await instr.withdrawSolend(hacker1, {
//       withdrawerTokenAccount: hacker1.publicKey,
//     }, true);
//     u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it("WithdrawSolend: Failure: Constraint: destination_collateral has wrong mint or vault_creator", async () => {
//     // wrong mint
//     const res1 = await instr.withdrawSolend(
//       citizen1,
//       {
//         destinationCollateral: vault2.getProtocol(UUID).destinationCollateral, // same vault_creator but different mint
//       },
//       true
//     );
//     assertSimulationError(res1, [
//       "PrivilegeEscalation",
//       "ProgramFailedToComplete",
//       2006,
//     ]);

//     // wrong vault_creator
//     const res2 = await instr.withdrawSolend(
//       citizen1,
//       {
//         destinationCollateral:
//           hacker1OwnedVault.getProtocol(UUID).destinationCollateral, // same mint but different vault_creator
//       },
//       true
//     );
//     assertSimulationError(res2, [
//       "PrivilegeEscalation",
//       "ProgramFailedToComplete",
//       2006,
//     ]);
//   });

//   it('WithdrawSolend: Failure: Constraint: program is wrong', async () => {
//     // Token Program
//     const res1 = await instr.withdrawSolend(hacker1, { tokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID }, true)
//     u.assertSimulationError(res1, [3008]);  // InvalidProgramId

// 	// Clock
//     const res3 = await instr.withdrawSolend(hacker1, { clock: anchor.web3.BPF_LOADER_PROGRAM_ID }, true)
//     u.assertSimulationError(res3, ["InvalidArgument"]);
//   });

//   it('WithdrawSolend: Failure: user_withdraws_disabled is true', async () => {
//     await changeVaultInfo(vault1, {
//         userWithdrawsDisabled: true,
//     });
//     await u.sleep(1000);  // wait till next slot

// 	const res = await instr.withdrawSolend(hacker1, {}, true);
// 	u.assertSimulationError(res, [accrueErrors.UserDepositWithdrawDisabledError]);

//     await changeVaultInfo(vault1);  // reset userWithdrawsDisabled
//     await u.sleep(1000);  // wait till next slot
//   });

//   it('WithdrawSolend: Failure: mint != vault_info.mint', async () => {
//     const res = await instr.withdrawSolend(hacker1, {
//       mint: vault2.mint.splToken.publicKey
//     }, true);
//     u.assertSimulationError(res, [accrueErrors.VaultInfoMintMismatchError]);
//   });

//   it('WithdrawSolend: Failure: withdrawer_accrue_token_account has wrong owner or mint', async () => {
//     // wrong owner
//     const res1 = await instr.withdrawSolend(hacker1, {
//       withdrawerAccrueTokenAccount: citizen1.accrueMintTokenAccount,
//     }, true);
//     u.assertSimulationError(res1, [accrueErrors.AccrueTokenAccountOwnershipError]);

//     // wrong mint
//     const res2 = await instr.withdrawSolend(hacker1, {
//       withdrawerAccrueTokenAccount: hacker1Vault2AccrueTokenAccount,
//     }, true);
//     u.assertSimulationError(res2, [accrueErrors.AccrueTokenAccountMintMismatchError]);
//   });

//   it('WithdrawSolend: Failure: withdrawer_token_account has wrong owner or mint', async () => {
//     // wrong owner
//     const res1 = await instr.withdrawSolend(hacker1, {
//       withdrawerTokenAccount: citizen1.mintTokenAccount,
//     }, true);
//     u.assertSimulationError(res1, [accrueErrors.TokenAccountOwnershipError]);

//     // wrong mint
//     const hacker1Vault2TokenAccount = await hacker1.createTokenAccount(vault2.mint);
//     const res2 = await instr.withdrawSolend(hacker1, {
//       withdrawerTokenAccount: hacker1Vault2TokenAccount,
//     }, true);
//     u.assertSimulationError(res2, [accrueErrors.TokenAccountMintMismatchError]);
//   });

//   it('WithdrawSolend: Failure: amount == 0', async () => {
//     const res = await instr.withdrawSolend(citizen1, {
//       withdrawAmount: new anchor.BN(0),
//     }, true);
//     u.assertSimulationError(res, [accrueErrors.WithdrawZeroError]);
//   });

//   it('WithdrawSolend: Failure: accrue_token_account.amount < withdraw amount', async () => {
//     const numTokens = (await hacker1.vault.accrueMint.getAccountInfo(hacker1.accrueMintTokenAccount)).amount;

//     const res = await instr.withdrawSolend(hacker1, {
//       withdrawAmount: numTokens.add(new anchor.BN(1)),
//     }, true);
//     u.assertSimulationError(res, [accrueErrors.WithdrawInsufficientFundsError]);
//   });

//   it("WithdrawSolend: Failure: protocol account was wrong", async () => {
//     // protocol_program
//     const res1 = await instr.withdrawSolend(
//       citizen1,
//       {
//         protocolProgram: new anchor.web3.Keypair().publicKey,
//       },
//       true
//     );
//     assertSimulationError(res1, [accrueErrors.ProtocolProgramMismatchError]);

//     // reserve
//     const res2 = await instr.withdrawSolend(
//       citizen1,
//       {
//         reserve: vault2.getProtocol(UUID).reserve,
//       },
//       true
//     );
//     assertSimulationError(res2, [accrueErrors.ProtocolReserveMismatchError]);

//     // reserve_liquidity_supply
//     const res3 = await instr.withdrawSolend(
//       citizen1,
//       {
//         reserveLiquiditySupply: vault2.getProtocol(UUID).reserveLiquiditySupply,
//       },
//       true
//     );
//     assertSimulationError(res3, [
//       accrueErrors.ProtocolReserveLiqSupplyMismatchError,
//     ]);

//     // reserve_collateral_mint
//     const res4 = await instr.withdrawSolend(
//       citizen1,
//       {
//         reserveCollateralMint: vault2.getProtocol(UUID).reserveCollateralMint.splToken.publicKey,
//       },
//       true
//     );
//     assertSimulationError(res4, [accrueErrors.ProtocolCMintMismatchError]);

//     // lending_market
//     const res5 = await instr.withdrawSolend(
//       citizen1,
//       {
//         lendingMarket: new anchor.web3.Keypair().publicKey,
//       },
//       true
//     );
//     assertSimulationError(res5, [
//       accrueErrors.ProtocolLendingMarketMismatchError,
//     ]);

//     // lending_market_auth
//     const res6 = await instr.withdrawSolend(
//       citizen1,
//       {
//         lendingMarketAuth: program.programId,
//       },
//       true
//     );
//     assertSimulationError(res6, [
//       accrueErrors.ProtocolLendingMarketAuthMismatchError,
//     ]);
//   });

//   it("WithdrawSolend: Success", async () => {
//     const vaultProtocol = vault1.getProtocol(UUID);
//     const withdrawerTokenBalanceBefore = (await mint1.splToken.getAccountInfo(citizen1.mintTokenAccount)).amount;

//     // Set distribution and Withdraw the 50% in the protocol
//     vault1.pool.distribution = u.U64_MAX.div(u.bn(2));
//     vaultProtocol.distribution = u.U64_MAX.div(u.bn(2)).add(u.bn(1));
//     const withdrawerATokenBalanceBefore = (await vault1.accrueMint.getAccountInfo(citizen1.accrueMintTokenAccount)).amount;
//     const withdrawAmount = withdrawerATokenBalanceBefore.div(u.bn(2));
//     const txn = new anchor.web3.Transaction();
//     txn.add(setDistributionInstr(vault1));
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.rebalanceSolendInstr(vault1));
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.withdrawSolendInstr(citizen1, {
//         withdrawAmount,
//     }));
//     /* 
//     withdraw_solend log
//     Instruction: WithdrawSolend
//     user's atoken balance: 11
//     user's atoken withdraw amount: 5
//     token_withdraw_amount: 4
//     ctoken_withdraw_amount: 3
//     ctoken_total_amount: 5
//     protocol_balance_before: 5
//     */
//     await program.provider.send(txn, [vault1.vaultCreator.keypair, citizen1.keypair]);

//     const vaultInfoAfter = await program.account.vaultInfo.fetch(
//         vault1.vaultInfo
//       );
//       assert(
//         vaultInfoAfter.protocols[0].lastUpdate.slot.gt(
//           vaultProtocol.lastUpdate.slot
//         )
//       ); // clock slot should've updated
//     vault1.pool.balance = citizen1.depositAmount.div(u.bn(2));
//     vault1.pool.lastUpdate.stale = false;
//     vault1.pool.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//     vaultProtocol.balance = citizen1.depositAmount.div(u.bn(2));  // not updated after withdrawing from protocol
//     vaultProtocol.lastUpdate.stale = true;
//     vaultProtocol.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//     vault1.balanceEstimate = u.bn(7);  // $11 - $4
//     vault1.assertEqual(vaultInfoAfter);

//     // make sure withdrawSolend moved the correct amount of money
//     await u.sleep(1000);  // wait till next slot
//     await instr.getBalanceSolend(vault1);
//     await u.sleep(1000);  // wait till next slot
//     const vaultInfoAfter2 = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     assert(
//       vaultInfoAfter2.protocols[0].lastUpdate.slot.gt(
//         vaultProtocol.lastUpdate.slot
//       )
//     ); // clock slot should've updated
//     vaultProtocol.balance = u.bn(2);  // should've removed all the money, but flooring twice leaves 2 tokens (see log comment above)
//     vaultProtocol.lastUpdate.stale = false;
//     vaultProtocol.lastUpdate.slot = vaultInfoAfter2.protocols[0].lastUpdate.slot;
//     vault1.assertEqual(vaultInfoAfter2);

//     // make sure user has correct amount of money
//     const withdrawerTokenBalanceAfter = (await vault1.mint.splToken.getAccountInfo(citizen1.mintTokenAccount)).amount;
//     const withdrawerTokenBalanceChange = withdrawerTokenBalanceAfter.sub(withdrawerTokenBalanceBefore);
//     // [(11 / 2) - 2]. Subtract 2 because we left 2 in the protocol (floored it)
//     const expectedBalanceChange = (citizen1.depositAmount.div(u.bn(2))).sub(u.bn(2));
//     assert(withdrawerTokenBalanceChange.eq(expectedBalanceChange), `${withdrawerTokenBalanceChange} does not equal expected balance: ${expectedBalanceChange}`);

//     // make sure user atokens were burned, and supply is correct
//     const withdrawerATokenBalanceAfter = (await vault1.accrueMint.getAccountInfo(citizen1.accrueMintTokenAccount)).amount;
//     const expctedATokenBalanceAfter = withdrawerATokenBalanceBefore.sub(withdrawAmount);
//     assert(withdrawerATokenBalanceAfter.eq(expctedATokenBalanceAfter));
//     const aTokenSupply = (await vault1.accrueMint.getMintInfo()).supply;
//     assert(aTokenSupply.eq(withdrawerATokenBalanceAfter));  // make sure tokens were actually burned, and withdrawer has all circulating supply
//   });    

//     /************************************************************
  
  
  
// 	KILL_SOLEND
  
  
  
// 	*************************************************************/

//     it("KillSolend: Failure: Constraint: vault_creator did not sign the txn", async () => {
//         // No signers
//         await chai
//           .expect(
//             // NOTE: not a simulation because `simulate` doesn't check signers
//             instr.killSolend(vault1, {
//               signers: [],
//             })
//           )
//           .to.be.rejectedWith("Signature verification failed");
    
//         // Wrong signer
//         await chai
//           .expect(
//             // NOTE: not a simulation because `simulate` doesn't check signers
//             instr.killSolend(vault1, {
//               signers: [hacker1.keypair],
//             })
//           )
//           .to.be.rejectedWith(`unknown signer: ${hacker1.publicKey}`);
//       });
    
//       it("KillSolend: Failure: Constraint: vault_info is not owned by program", async () => {
//         const res = await instr.killSolend(
//           vault1,
//           {
//             vaultInfo: hacker1.mintTokenAccount,
//           },
//           true
//         );
//         assertSimulationError(res, [3007]); // AccountOwnedByWrongProgram
//       });
    
//       it("KillSolend: Failure: Constraint: pool has wrong mint or vault_creator", async () => {
//         // wrong mint
//         const res1 = await instr.killSolend(
//           vault1,
//           {
//             pool: vault2.pool.publicKey, // same vault_creator but different mint
//           },
//           true
//         );
//         assertSimulationError(res1, [
//           "PrivilegeEscalation",
//           "ProgramFailedToComplete",
//           2006,
//         ]);
    
//         // wrong vault_creator
//         const res2 = await instr.killSolend(
//           vault1,
//           {
//             pool: hacker1OwnedVault.pool.publicKey, // same mint but different vault_creator
//           },
//           true
//         );
//         assertSimulationError(res2, [
//           "PrivilegeEscalation",
//           "ProgramFailedToComplete",
//           2006,
//         ]);
//       });
    
//       it("KillSolend: Failure: Constraint: destination_collateral has wrong mint or vault_creator", async () => {
//         // wrong mint
//         const res1 = await instr.killSolend(
//           vault1,
//           {
//             destinationCollateral: vault2.getProtocol(UUID).destinationCollateral, // same vault_creator but different mint
//           },
//           true
//         );
//         assertSimulationError(res1, [
//           "PrivilegeEscalation",
//           "ProgramFailedToComplete",
//           2006,
//         ]);
    
//         // wrong vault_creator
//         const res2 = await instr.killSolend(
//           vault1,
//           {
//             destinationCollateral:
//               hacker1OwnedVault.getProtocol(UUID).destinationCollateral, // same mint but different vault_creator
//           },
//           true
//         );
//         assertSimulationError(res2, [
//           "PrivilegeEscalation",
//           "ProgramFailedToComplete",
//           2006,
//         ]);
//       });
    
//       it("KillSolend: Failure: Constraint: program was wrong", async () => {
//         // Token Program
//         const res2 = await instr.killSolend(
//           vault1,
//           {
//             tokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
//           },
//           true
//         );
//         assertSimulationError(res2, [3008, "InvalidArgument"]); // InvalidProgramId
    
//         // Rent
//         const res3 = await instr.killSolend(
//           vault1,
//           {
//             clock: anchor.web3.SystemProgram.programId,
//           },
//           true
//         );
//         assertSimulationError(res3, [3008, "InvalidArgument"]);
//       });
    
//       it("KillSolend: Failure: vault_creator did not create this vault", async () => {
//         const res = await instr.killSolend(
//           vault1,
//           {
//             vaultCreator: hacker1.publicKey,
//             signers: [hacker1.keypair],
//           },
//           true
//         );
//         assertSimulationError(res, [accrueErrors.VaultCreatorOwnershipError]);
//       });
    
//       it("KillSolend: Failure: protocol account was wrong", async () => {
//         // protocol_program
//         const res1 = await instr.killSolend(
//           vault1,
//           {
//             protocolProgram: new anchor.web3.Keypair().publicKey,
//           },
//           true
//         );
//         assertSimulationError(res1, [accrueErrors.ProtocolProgramMismatchError]);
    
//         // reserve
//         const res2 = await instr.killSolend(
//           vault1,
//           {
//             reserve: vault2.getProtocol(UUID).reserve,
//           },
//           true
//         );
//         assertSimulationError(res2, [accrueErrors.ProtocolReserveMismatchError]);
    
//         // reserve_liquidity_supply
//         const res3 = await instr.killSolend(
//           vault1,
//           {
//             reserveLiquiditySupply: vault2.getProtocol(UUID).reserveLiquiditySupply,
//           },
//           true
//         );
//         assertSimulationError(res3, [
//           accrueErrors.ProtocolReserveLiqSupplyMismatchError,
//         ]);
    
//         // reserve_collateral_mint
//         const res4 = await instr.killSolend(
//           vault1,
//           {
//             reserveCollateralMint: vault2.getProtocol(UUID).reserveCollateralMint.splToken.publicKey,
//           },
//           true
//         );
//         assertSimulationError(res4, [accrueErrors.ProtocolCMintMismatchError]);
    
//         // lending_market
//         const res5 = await instr.killSolend(
//           vault1,
//           {
//             lendingMarket: new anchor.web3.Keypair().publicKey,
//           },
//           true
//         );
//         assertSimulationError(res5, [
//           accrueErrors.ProtocolLendingMarketMismatchError,
//         ]);
    
//         // lending_market_auth
//         const res6 = await instr.killSolend(
//           vault1,
//           {
//             lendingMarketAuth: program.programId,
//           },
//           true
//         );
//         assertSimulationError(res6, [
//           accrueErrors.ProtocolLendingMarketAuthMismatchError,
//         ]);
//       });

//     it("KillSolend: Failure: balance is stale", async () => {
//         const res = await instr.killSolend(vault1, {}, true);
//         assertSimulationError(res, [accrueErrors.LocationStaleError]);
//     });

//       it("KillSolend: Success: Funds exist in the protocol", async () => {
//         // assert that there are funds in the protocol
//         const vaultProtocol = vault1.getProtocol(UUID);
//         const balanceBefore = (await vaultProtocol.reserveCollateralMint.splToken.getAccountInfo(
//             vaultProtocol.destinationCollateral
//         )).amount;
//         assert(!balanceBefore.isZero());

//         const txn = new anchor.web3.Transaction();
//         txn.add(instr.getBalanceSolendInstr(vault1));
//         txn.add(instr.killSolendInstr(vault1));
//         await program.provider.send(txn, [vault1.vaultCreator.keypair]);
    
//         const vaultInfoAfter = await program.account.vaultInfo.fetch(
//           vault1.vaultInfo
//         );
//         assert(
//           vaultInfoAfter.protocols[0].lastUpdate.slot.gt(
//             vaultProtocol.lastUpdate.slot
//           )
//         ); // clock slot should've updated
//         vaultProtocol.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//         vaultProtocol.lastUpdate.stale = true;
//         vault1.pool.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//         vault1.pool.lastUpdate.stale = true;
//         vault1.assertEqual(vaultInfoAfter);

//         // assert that we have 0 ctokens
//         const balanceAfter = (await vaultProtocol.reserveCollateralMint.splToken.getAccountInfo(
//             vaultProtocol.destinationCollateral
//         )).amount;
//         assert(balanceAfter.isZero());
//       });

//       it("KillSolend: Failure: No balance in the protocol", async () => {
//         // assert that there is 0 balance in the protocol
//         const vaultProtocol = vault1.getProtocol(UUID);
//         const balance = (await vaultProtocol.reserveCollateralMint.splToken.getAccountInfo(
//             vaultProtocol.destinationCollateral
//         )).amount;
//         assert(balance.isZero());

//         const txn = new anchor.web3.Transaction();
//         txn.add(instr.getBalanceSolendInstr(vault1));
//         txn.add(instr.killSolendInstr(vault1));
//         const res = await program.provider.simulate(txn, [vault1.vaultCreator.keypair]);
//         assertSimulationError(res, [accrueErrors.KillNoBalanceError], 1);
//       });
// });
