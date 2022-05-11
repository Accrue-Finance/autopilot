// import * as anchor from "@project-serum/anchor";
// import * as spl from "@solana/spl-token";
// import _ from "lodash";
// import * as chai from "chai";
// import * as chaiAsPromised from "chai-as-promised";
// import * as u from "./general/utils";
// import { Mint, User, Vault } from "./vault/classes";
// import { changeVaultInfoInstr, initVault, setDistribution, setDistributionInstr } from "./vault/instructions";
// import { withdrawPoolInstr } from "./pool/instructions";
// import { depositPoolInstr } from "./pool/instructions";
// import * as instr from "./protocols/solend/instructions";
// import {
//   assertSimulationError,
// } from "./general/utils";
// import {
//   SolendProtocol,
//   SOLEND_UUID,
//   SOLEND_ACCOUNTS,
// } from "./protocols/solend/classes";
// import {
//   PYTH_ORACLE_MAINNET,
//   SWITCHBOARD_ORACLE_MAINNET,
// } from "./protocols/protocol";
// import * as solendSdk from "@solendprotocol/solend-sdk";
// import { SOL_DEVNET, USDC_DEVNET } from "./general/accounts";
// import { Autopilot } from "../target/types/autopilot";
// import { POOL_UUID } from "./pool/classes";
// const { assert } = chai;
// chai.use(chaiAsPromised.default);

// const UUID = SOLEND_UUID;

// describe("solend", () => {
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

//   let hacker1Vault2AccrueTokenAccount: anchor.web3.PublicKey; // hacker1's accrue mint account for vault2

//   const users = [
//     mintCreator,
//     vaultCreator,
//     citizen1,
//     hacker1,
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
//   });

//   /************************************************************



//   INIT_SOLEND



//   *************************************************************/

//   it("InitSolend: Failure: Constraint: vault_creator did not sign the txn", async () => {
//     // No signers
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.initSolend(vault1, {
//           signers: [],
//         })
//       )
//       .to.be.rejectedWith("Signature verification failed");

//     // Wrong signer
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.initSolend(vault1, {
//           signers: [hacker1.keypair],
//         })
//       )
//       .to.be.rejectedWith(`unknown signer: ${hacker1.publicKey}`);
//   });

//   it("InitSolend: Failure: Constraint: vault_info is not owned by program", async () => {
//     const res = await instr.initSolend(
//       vault1,
//       {
//         vaultInfo: hacker1.mintTokenAccount,
//       },
//       true
//     );
//     assertSimulationError(res, [3007]); // AccountOwnedByWrongProgram
//   });

//   it("InitSolend: Failure: Constraint: destination_collateral has wrong mint or vault_creator", async () => {
//     // wrong mint
//     const res1 = await instr.initSolend(
//       vault1,
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
//     const res2 = await instr.initSolend(
//       vault1,
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

//   it("InitSolend: Failure: Constraint: program was wrong", async () => {
//     // System Program
//     const res1 = await instr.initSolend(
//       vault1,
//       {
//         systemProgram: anchor.web3.BPF_LOADER_PROGRAM_ID,
//       },
//       true
//     );
//     assertSimulationError(res1, [3008, "InvalidArgument"]);

//     // Token Program
//     const res2 = await instr.initSolend(
//       vault1,
//       {
//         tokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
//       },
//       true
//     );
//     assertSimulationError(res2, [3008, "InvalidArgument"]); // InvalidProgramId

//     // Rent
//     const res3 = await instr.initSolend(
//       vault1,
//       {
//         rent: anchor.web3.SystemProgram.programId,
//       },
//       true
//     );
//     assertSimulationError(res3, [3008, "InvalidArgument"]);
//   });

//   it("InitSolend: Failure: vault_creator did not create this vault", async () => {
//     const res = await instr.initSolend(
//       vault1,
//       {
//         vaultCreator: hacker1.publicKey,
//         signers: [hacker1.keypair],
//       },
//       true
//     );
//     assertSimulationError(res, [accrueErrors.VaultCreatorOwnershipError]);
//     // should mess up pool seeds -> ConstraintSeeds error
//   });

//   it("InitSolend: Failure: destinational_collateral_mint is wrong", async () => {
//     const vault2solend = vault2.getProtocol(UUID);
//     const res = await instr.initSolend(
//       vault1,
//       { destinationCollateralMint: vault2solend.reserveCollateralMint.splToken.publicKey },
//       true
//     );
//     assertSimulationError(res, [accrueErrors.ProtocolCMintMismatchError]);
//   });

//   it("InitSolend: Failure: max_protocols reached", async () => {
//     const txn = new anchor.web3.Transaction();
//     txn.add(changeVaultInfoInstr(vault1, {
//         newProtocolsMax: u.bn(0),
//     }));
//     txn.add(instr.initSolendInstr(vault1));
//     const res = await program.provider.simulate(txn, [vault1.vaultCreator.keypair]);
//     assertSimulationError(res, [accrueErrors.ProtocolMaximumError], 1);
//   });

//   it("InitSolend: Success", async () => {
//     for (let i = 0; i < vaults.length; i++) {
//       const vault = vaults[i];
//       await instr.initSolend(vault);
//       await u.sleep(2000);  // necessary
//       const vaultInfoAfter = await program.account.vaultInfo.fetch(
//         vault.vaultInfo
//       );
//       vault.assertEqual(vaultInfoAfter);
//     }
//   });

//   it("InitSolend: Failure: Cannot initialize again", async () => {
//     const res = await instr.initSolend(vault1, {}, true);
//     assertSimulationError(res, [accrueErrors.ProtocolAlreadyExists, 0]); // for some reason it's 0x0 in devnet
//   });

//   /************************************************************
  
  
  
// 	GET_BALANCE_SOLEND
  
  
  
// 	*************************************************************/

//   it("GetBalance: Failure: Constraint: vault_info is not owned by program", async () => {
//     const res = await instr.getBalanceSolend(
//       vault1,
//       {
//         vaultInfo: hacker1.mintTokenAccount,
//       },
//       true
//     );
//     assertSimulationError(res, [3007]); // AccountOwnedByWrongProgram
//   });

//   it("GetBalance: Failure: Constraint: destination_collateral has wrong mint or vault_creator", async () => {
//     // wrong mint
//     const res1 = await instr.getBalanceSolend(
//       vault1,
//       {
//         destinationCollateral: vault2.getProtocol(UUID).destinationCollateral, // same vault_creator but different mint
//       },
//       true
//     );
//     assertSimulationError(res1, [2006]); // ConstraintSeeds

//     // wrong vault_creator
//     const res2 = await instr.getBalanceSolend(
//       vault1,
//       {
//         destinationCollateral:
//           hacker1OwnedVault.getProtocol(UUID).destinationCollateral, // same mint but different vault_creator
//       },
//       true
//     );
//     assertSimulationError(res2, [2006]); // ConstraintSeeds
//   });

//   it("GetBalance: Failure: Constraint: program was wrong", async () => {
//     // Token Program
//     const res2 = await instr.getBalanceSolend(
//       vault1,
//       {
//         tokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
//       },
//       true
//     );
//     assertSimulationError(res2, [3008]); // InvalidProgramId

//     // Clock
//     const res3 = await instr.getBalanceSolend(
//       vault1,
//       {
//         clock: anchor.web3.SystemProgram.programId,
//       },
//       true
//     );
//     assertSimulationError(res3, ["InvalidArgument"]);
//   });

//   it("GetBalance: Failure: protocol account was wrong", async () => {
//     // protocol_program
//     const res1 = await instr.getBalanceSolend(
//       vault1,
//       {
//         protocolProgram: new anchor.web3.Keypair().publicKey,
//       },
//       true
//     );
//     assertSimulationError(res1, [accrueErrors.ProtocolProgramMismatchError]);

//     // reserve
//     const res2 = await instr.getBalanceSolend(
//       vault1,
//       {
//         reserve: vault2.getProtocol(UUID).reserve,
//       },
//       true
//     );
//     assertSimulationError(res2, [accrueErrors.ProtocolReserveMismatchError]);

//     // oracle (pyth)
//     const res3 = await instr.getBalanceSolend(
//       vault1,
//       {
//         pythOracle: PYTH_ORACLE_MAINNET,
//       },
//       true
//     );
//     assertSimulationError(res3, [accrueErrors.ProtocolOracleMismatchError]);

//     // oracle (switchboard)
//     const res4 = await instr.getBalanceSolend(
//       vault1,
//       {
//         switchboardOracle: SWITCHBOARD_ORACLE_MAINNET,
//       },
//       true
//     );
//     assertSimulationError(res4, [accrueErrors.ProtocolOracleMismatchError]);
//   });

//   it("GetBalance: Success: balance = 0", async () => {
//     const vaultProtocol = vault1.getProtocol(UUID);

//     // pool balance should be stale
//     vault1.pool.lastUpdate.stale = true;

//     // protocol balance should be updated
//     assert(vaultProtocol.lastUpdate.slot.isZero()); // we shouldve never called `getBalance` yet
//     vaultProtocol.lastUpdate.stale = false;

//     const solendMintInfo = _.find(SOLEND_ACCOUNTS.mints, (m) =>
//       m.address.equals(vault1.mint.splToken.publicKey)
//     );

//     await u.sleep(1000); // make sure we hit next block
//     await instr.getBalanceSolend(vault1);
//     await u.sleep(1000); // make sure we hit next block

//     // get reserve info immediately after updating balance
//     const reserveAccountInfo = await connection.getAccountInfo(
//       solendMintInfo.reserve
//     );
//     const parsedReserve = solendSdk.parseReserve(
//       solendMintInfo.reserve,
//       reserveAccountInfo
//     );

//     const vaultInfoAfter = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     assert(
//       vaultInfoAfter.protocols[0].lastUpdate.slot.gt(
//         vaultProtocol.lastUpdate.slot
//       )
//     ); // clock slot should've updated
//     vaultProtocol.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;

//     vault1.assertEqual(vaultInfoAfter);

//     // check if reserve was refreshed in the same slot (or is greater than, just incase another devnetter updated it)
//     assert(
//       parsedReserve.info.lastUpdate.slot.gte(vaultProtocol.lastUpdate.slot)
//     );
//   });

//   /************************************************************
  
  
  
// 	REBALANCE_SOLEND
  
  
  
// 	*************************************************************/

//   it("RebalanceSolend: Failure: Constraint: vault_creator did not sign the txn", async () => {
//     // No signers
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.rebalanceSolend(vault1, {
//           signers: [],
//         })
//       )
//       .to.be.rejectedWith("Signature verification failed");

//     // Wrong signer
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.rebalanceSolend(vault1, {
//           signers: [hacker1.keypair],
//         })
//       )
//       .to.be.rejectedWith(`unknown signer: ${hacker1.publicKey}`);
//   });

//   it("RebalanceSolend: Failure: Constraint: vault_info is not owned by program", async () => {
//     const res = await instr.rebalanceSolend(
//       vault1,
//       {
//         vaultInfo: hacker1.mintTokenAccount,
//       },
//       true
//     );
//     assertSimulationError(res, [3007]); // AccountOwnedByWrongProgram
//   });

//   it("RebalanceSolend: Failure: Constraint: pool has wrong mint or vault_creator", async () => {
//     // wrong mint
//     const res1 = await instr.rebalanceSolend(
//       vault1,
//       {
//         pool: vault2.pool.publicKey, // same vault_creator but different mint
//       },
//       true
//     );
//     assertSimulationError(res1, [
//       "PrivilegeEscalation",
//       "ProgramFailedToComplete",
//       2006,
//     ]);

//     // wrong vault_creator
//     const res2 = await instr.rebalanceSolend(
//       vault1,
//       {
//         pool: hacker1OwnedVault.pool.publicKey, // same mint but different vault_creator
//       },
//       true
//     );
//     assertSimulationError(res2, [
//       "PrivilegeEscalation",
//       "ProgramFailedToComplete",
//       2006,
//     ]);
//   });

//   it("RebalanceSolend: Failure: Constraint: destination_collateral has wrong mint or vault_creator", async () => {
//     // wrong mint
//     const res1 = await instr.rebalanceSolend(
//       vault1,
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
//     const res2 = await instr.rebalanceSolend(
//       vault1,
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

//   it("RebalanceSolend: Failure: Constraint: program was wrong", async () => {
//     // Token Program
//     const res2 = await instr.rebalanceSolend(
//       vault1,
//       {
//         tokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
//       },
//       true
//     );
//     assertSimulationError(res2, [3008, "InvalidArgument"]); // InvalidProgramId

//     // Rent
//     const res3 = await instr.rebalanceSolend(
//       vault1,
//       {
//         clock: anchor.web3.SystemProgram.programId,
//       },
//       true
//     );
//     assertSimulationError(res3, [3008, "InvalidArgument"]);
//   });

//   it("RebalanceSolend: Failure: vault_creator did not create this vault", async () => {
//     const res = await instr.rebalanceSolend(
//       vault1,
//       {
//         vaultCreator: hacker1.publicKey,
//         signers: [hacker1.keypair],
//       },
//       true
//     );
//     assertSimulationError(res, [accrueErrors.VaultCreatorOwnershipError]);
//   });

//   it("RebalanceSolend: Failure: protocol account was wrong", async () => {
//     // protocol_program
//     const res1 = await instr.rebalanceSolend(
//       vault1,
//       {
//         protocolProgram: new anchor.web3.Keypair().publicKey,
//       },
//       true
//     );
//     assertSimulationError(res1, [accrueErrors.ProtocolProgramMismatchError]);

//     // reserve
//     const res2 = await instr.rebalanceSolend(
//       vault1,
//       {
//         reserve: vault2.getProtocol(UUID).reserve,
//       },
//       true
//     );
//     assertSimulationError(res2, [accrueErrors.ProtocolReserveMismatchError]);

//     // reserve_liquidity_supply
//     const res3 = await instr.rebalanceSolend(
//       vault1,
//       {
//         reserveLiquiditySupply: vault2.getProtocol(UUID).reserveLiquiditySupply,
//       },
//       true
//     );
//     assertSimulationError(res3, [
//       accrueErrors.ProtocolReserveLiqSupplyMismatchError,
//     ]);

//     // reserve_collateral_mint
//     const res4 = await instr.rebalanceSolend(
//       vault1,
//       {
//         reserveCollateralMint: vault2.getProtocol(UUID).reserveCollateralMint.splToken.publicKey,
//       },
//       true
//     );
//     assertSimulationError(res4, [accrueErrors.ProtocolCMintMismatchError]);

//     // lending_market
//     const res5 = await instr.rebalanceSolend(
//       vault1,
//       {
//         lendingMarket: new anchor.web3.Keypair().publicKey,
//       },
//       true
//     );
//     assertSimulationError(res5, [
//       accrueErrors.ProtocolLendingMarketMismatchError,
//     ]);

//     // lending_market_auth
//     const res6 = await instr.rebalanceSolend(
//       vault1,
//       {
//         lendingMarketAuth: program.programId,
//       },
//       true
//     );
//     assertSimulationError(res6, [
//       accrueErrors.ProtocolLendingMarketAuthMismatchError,
//     ]);
//   });

//   it("RebalanceSolend: Failure: protocol balance stale", async () => {
//     const res = await instr.rebalanceSolend(vault1, {}, true);
//     assertSimulationError(res, [accrueErrors.LocationStaleError]);
//   });

//   it("RebalanceSolend: Success: total balance = 0", async () => {
//     const vaultProtocol = vault1.getProtocol(UUID);

//     const txn = new anchor.web3.Transaction();
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.rebalanceSolendInstr(vault1));
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     await program.provider.send(txn, [vault1.vaultCreator.keypair]);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction

//     const vaultInfoAfter = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     assert(
//       vaultInfoAfter.protocols[0].lastUpdate.slot.gt(
//         vaultProtocol.lastUpdate.slot
//       )
//     ); // clock slot should've updated

//     vault1.pool.lastUpdate.stale = true;
//     vault1.pool.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//     vaultProtocol.lastUpdate.stale = true;
//     vaultProtocol.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//     vault1.assertEqual(vaultInfoAfter);

//     // make sure rebalance moved the correct amount of money
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     await instr.getBalanceSolend(vault1);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     const vaultInfoAfter2 = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     assert(
//       vaultInfoAfter2.protocols[0].lastUpdate.slot.gt(
//         vaultProtocol.lastUpdate.slot
//       )
//     ); // clock slot should've updated
//     // vault1.pool.balance = u.bn(0);  should be unchanged (stale)
//     vault1.pool.lastUpdate.stale = true;
//     vaultProtocol.balance = u.bn(0);
//     vaultProtocol.lastUpdate.stale = false;
//     vaultProtocol.lastUpdate.slot =
//       vaultInfoAfter2.protocols[0].lastUpdate.slot;
//     vault1.assertEqual(vaultInfoAfter2);
//   });

//   it("RebalanceSolend: Success: total balance > 0, distribution = 100% pool 0% protocol, do nothing with protocol", async () => {
//     assert(!citizen1.depositAmount.isZero());
//     const txn1 = new anchor.web3.Transaction();
//     txn1.add(instr.getBalanceSolendInstr(vault1));
//     txn1.add(depositPoolInstr(citizen1));
//     await u.sleep(1000); // make sure we wait till next block
//     await program.provider.send(txn1, [citizen1.keypair]);
//     await u.sleep(1000); // make sure we wait till next block

//     const vaultProtocol = vault1.getProtocol(UUID);

//     const txn2 = new anchor.web3.Transaction();
//     txn2.add(instr.getBalanceSolendInstr(vault1));
//     txn2.add(instr.rebalanceSolendInstr(vault1));
//     await u.sleep(1000); // make sure we wait till next block
//     await program.provider.send(txn2, [vault1.vaultCreator.keypair]);
//     await u.sleep(1000); // make sure we wait till next block

//     const vaultInfoAfter = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     assert(
//       vaultInfoAfter.protocols[0].lastUpdate.slot.gt(
//         vaultProtocol.lastUpdate.slot
//       )
//     ); // clock slot should've updated

//     vault1.pool.balance = citizen1.depositAmount;
//     vault1.pool.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//     vault1.pool.lastUpdate.stale = true;
//     vaultProtocol.balance = u.bn(0);
//     vaultProtocol.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//     vaultProtocol.lastUpdate.stale = true;
//     vault1.balanceEstimate = citizen1.depositAmount;
//     vault1.assertEqual(vaultInfoAfter);

//     // make sure rebalance moved the correct amount of money
//     await u.sleep(1000); // make sure we wait till next block
//     await instr.getBalanceSolend(vault1);
//     await u.sleep(1000); // make sure we wait till next block
//     const vaultInfoAfter2 = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     assert(
//       vaultInfoAfter2.protocols[0].lastUpdate.slot.gt(
//         vaultProtocol.lastUpdate.slot
//       )
//     ); // clock slot should've updated
//     // vault1.pool.balance = citizen1.depositAmount;  should be unchanged (stale)
//     vault1.pool.lastUpdate.stale = true;
//     vaultProtocol.balance = u.bn(0);
//     vaultProtocol.lastUpdate.stale = false;
//     vaultProtocol.lastUpdate.slot =
//       vaultInfoAfter2.protocols[0].lastUpdate.slot;
//     vault1.assertEqual(vaultInfoAfter2);
//   });

//   it("SetDistribution: Quick test to make sure we can set distribution to this protocol!", async () => {
//     const vaultProtocol = vault1.getProtocol(UUID);

//     // set distribution to [50% pool, 50% protocol], but disable protocol!
//     vault1.pool.distribution = u.U64_MAX.div(u.bn(2)); // ~50%
//     vaultProtocol.distribution = u.U64_MAX.div(u.bn(2)).add(u.bn(1)); // ~50%, add 1 to get to U64_MAX
//     vaultProtocol.depositsDisabled = true;  // disable protocol
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     await setDistribution(vault1);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction

//     const vaultInfoAfter = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     vault1.assertEqual(vaultInfoAfter);
//   });

//   it("RebalanceSolend: Failure: protocol deposits disabled", async () => {
//     const txn = new anchor.web3.Transaction();
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.rebalanceSolendInstr(vault1));
//     const res = await program.provider.simulate(txn, [vault1.vaultCreator.keypair]);
//     assertSimulationError(res, [accrueErrors.ProtocolDisabledError], 1);
//   });

//   it("SetDistribution: Enable protocol", async () => {
//     const vaultProtocol = vault1.getProtocol(UUID);
//     vaultProtocol.depositsDisabled = false;  // enable protocol
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     await setDistribution(vault1);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction

//     const vaultInfoAfter = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     vault1.assertEqual(vaultInfoAfter);
//   });

//   it("RebalanceSolend: Success: total balance > 0, distribution = 50% pool 50% protocol", async () => {
//     const vaultProtocol = vault1.getProtocol(UUID);

//     // check that balance is 50/50
//     assert(vault1.pool.distribution.eq(u.U64_MAX.div(u.bn(2))));
//     assert(vaultProtocol.distribution.eq(u.U64_MAX.div(u.bn(2)).add(u.bn(1))));

//     const txn = new anchor.web3.Transaction();
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.rebalanceSolendInstr(vault1));
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     await program.provider.send(txn, [vault1.vaultCreator.keypair]);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction

//     const vaultInfoAfter = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     assert(
//       vaultInfoAfter.protocols[0].lastUpdate.slot.gt(
//         vaultProtocol.lastUpdate.slot
//       )
//     ); // clock slot should've updated

//     // total balance was 11 before. We should be depositing 5 into Solend (because 11 * RATIO rounds = 5.55 -> 5)
//     // Final values expected:
//     // - total_balance    = 11 <- 10 (explained 2 lines lower)
//     // - pool_balance     = 6
//     // - protocol_balance = 5 <- ACTUALLY will be 4 because protocol `floor`s our deposit. So total balance is 10

//     vault1.pool.balance = u.bn(11); // stale balance. Actual is 6
//     vault1.pool.lastUpdate.stale = true;
//     vault1.pool.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//     vaultProtocol.balance = u.bn(0); // stale balance. Actual is 4
//     vaultProtocol.lastUpdate.stale = true;
//     vaultProtocol.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//     vault1.balanceEstimate = u.bn(11); 
//     vault1.assertEqual(vaultInfoAfter);

//     // make sure rebalance moved the correct amount of money
//     await instr.getBalanceSolend(vault1);
//     const vaultInfoAfter2 = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     assert(
//       vaultInfoAfter2.protocols[0].lastUpdate.slot.gt(
//         vaultProtocol.lastUpdate.slot
//       )
//     ); // clock slot should've updated
//     // vault1.pool.balance = u.bn(6);  should be unchanged (stale)
//     vault1.pool.lastUpdate.stale = true;
//     vaultProtocol.balance = u.bn(4);
//     vaultProtocol.lastUpdate.stale = false;
//     vaultProtocol.lastUpdate.slot =
//       vaultInfoAfter2.protocols[0].lastUpdate.slot;
//     vault1.assertEqual(vaultInfoAfter2);
//   });

//   it("WithdrawPool: Failure: Pool doesn't have enough funds", async () => {
//     const txn = new anchor.web3.Transaction();
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(withdrawPoolInstr(citizen1));
//     const res = await program.provider.simulate(txn, [citizen1.keypair]);
//     assertSimulationError(res, [accrueErrors.LocationInsufficientFundsError], 1);
//   });

//   it("WithdrawPool: Failure: Location is stale", async () => {
//     const txn = new anchor.web3.Transaction();
//     txn.add(withdrawPoolInstr(citizen1));
//     const res = await program.provider.simulate(txn, [citizen1.keypair]);
//     assertSimulationError(res, [accrueErrors.LocationStaleError]);
//   });

//   it("DepositPool: Failure: Location is stale", async () => {
//     const txn = new anchor.web3.Transaction();
//     txn.add(depositPoolInstr(citizen1));
//     const res = await program.provider.simulate(txn, [citizen1.keypair]);
//     assertSimulationError(res, [accrueErrors.LocationStaleError]);
//   });

//   it("DeleteSolend: Failure: balance exists in protocol", async () => {
//     const txn = new anchor.web3.Transaction();
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.deleteSolendInstr(vault1));
//     const res = await program.provider.simulate(txn, [
//       vault1.vaultCreator.keypair,
//     ]);
//     assertSimulationError(res, [accrueErrors.ProtocolHasBalanceError], 1);
//   });

//   it("RebalanceSolend: Success: total balance > 0, distribution = 100% pool 0% protocol, withdraw from protocol", async () => {
//     const vaultProtocol = vault1.getProtocol(UUID);
//     vault1.pool.distribution = u.U64_MAX;
//     vaultProtocol.distribution = u.bn(0);
//     await setDistribution(vault1);

//     const txn = new anchor.web3.Transaction();
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.rebalanceSolendInstr(vault1));
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     await program.provider.send(txn, [vault1.vaultCreator.keypair]);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction

//     const vaultInfoAfter = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     assert(
//       vaultInfoAfter.protocols[0].lastUpdate.slot.gt(
//         vaultProtocol.lastUpdate.slot
//       )
//     ); // clock slot should've updated
//     vaultProtocol.balance = u.bn(4); // actual balance is 0 but this is stale
//     vaultProtocol.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//     vaultProtocol.lastUpdate.stale = true;
//     vault1.pool.balance = u.bn(6); // actual balance is 10 but this is stale (not 11 because we lost 1 unit when we floored with Solend)
//     vault1.pool.lastUpdate.slot = vaultInfoAfter.protocols[0].lastUpdate.slot;
//     vault1.pool.lastUpdate.stale = true;
//     vault1.balanceEstimate = u.bn(11);
//     vault1.assertEqual(vaultInfoAfter);

//     // make sure rebalance moved the correct amount of money
//     await instr.getBalanceSolend(vault1);
//     const vaultInfoAfter2 = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     assert(
//       vaultInfoAfter2.protocols[0].lastUpdate.slot.gt(
//         vaultProtocol.lastUpdate.slot
//       )
//     ); // clock slot should've updated
//     // vault1.pool.balance = u.bn(10);  should be unchanged (stale)
//     vault1.pool.lastUpdate.stale = true;
//     vaultProtocol.balance = u.bn(0);
//     vaultProtocol.lastUpdate.stale = false;
//     vaultProtocol.lastUpdate.slot =
//       vaultInfoAfter2.protocols[0].lastUpdate.slot;
//     vault1.assertEqual(vaultInfoAfter2);
//   });

//   /************************************************************
  
  
  
// 	DELETE_SOLEND
  
  
  
// 	*************************************************************/

//   it("DeleteSolend: Failure: Constraint: vault_creator did not sign the txn", async () => {
//     // No signers
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.deleteSolend(vault1, {
//           signers: [],
//         })
//       )
//       .to.be.rejectedWith("Signature verification failed");

//     // Wrong signer
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.deleteSolend(vault1, {
//           signers: [hacker1.keypair],
//         })
//       )
//       .to.be.rejectedWith(`unknown signer: ${hacker1.publicKey}`);
//   });

//   it("DeleteSolend: Failure: Constraint: vault_info is not owned by program", async () => {
//     const res = await instr.deleteSolend(
//       vault1,
//       {
//         vaultInfo: hacker1.mintTokenAccount,
//       },
//       true
//     );
//     assertSimulationError(res, [3007]); // AccountOwnedByWrongProgram
//   });

//   it("DeleteSolend: Failure: Constraint: destination_collateral has wrong mint or vault_creator", async () => {
//     // wrong mint
//     const res1 = await instr.deleteSolend(
//       vault1,
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
//     const res2 = await instr.deleteSolend(
//       vault1,
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

//   it("DeleteSolend: Failure: Constraint: program was wrong", async () => {
//     // Clock
//     const res3 = await instr.deleteSolend(
//       vault1,
//       {
//         clock: anchor.web3.SystemProgram.programId,
//       },
//       true
//     );
//     assertSimulationError(res3, [3008, "InvalidArgument"]);
//   });

//   it("DeleteSolend: Failure: vault_creator did not create this vault", async () => {
//     const res = await instr.deleteSolend(
//       vault1,
//       {
//         vaultCreator: hacker1.publicKey,
//         signers: [hacker1.keypair],
//       },
//       true
//     );
//     assertSimulationError(res, [accrueErrors.VaultCreatorOwnershipError]);
//   });

//   it("DeleteSolend: Failure: balance is stale", async () => {
//     const res = await instr.deleteSolend(vault1, {}, true);
//     assertSimulationError(res, [accrueErrors.LocationStaleError]);
//   });

//   it("DeleteSolend: Failure: Distribution is not zero", async () => {
//     // set distribution to 50% 50%
//     vault1.pool.distribution = u.U64_MAX.div(u.bn(2));
//     vault1.protocols[0].distribution = u.U64_MAX.div(u.bn(2)).add(u.bn(1));

//     const txn = new anchor.web3.Transaction();
//     txn.add(setDistributionInstr(vault1));
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.deleteSolendInstr(vault1));
//     const res = await program.provider.simulate(txn, [vault1.vaultCreator.keypair]);
//     assertSimulationError(res, [accrueErrors.ProtocolDistributionNotZeroError], 2);
//   })

//   it("DeleteSolend: Success", async () => {
//     // set distribution to 100% 0%
//     vault1.pool.distribution = u.U64_MAX;
//     vault1.getProtocol(UUID).distribution = u.bn(0);

//     const txn = new anchor.web3.Transaction();
//     txn.add(setDistributionInstr(vault1));
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.deleteSolendInstr(vault1));
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     await program.provider.send(txn, [vault1.vaultCreator.keypair]);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction

//     // account should not have been deleted
//     const ctokenAccount = await vault1.getProtocol(UUID).reserveCollateralMint.splToken.getAccountInfo(
//         vault1.getProtocol(UUID).destinationCollateral
//     );
//     assert(ctokenAccount.amount.isZero());

//     vault1.protocols = [];
//     const vaultInfoAfter = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     vault1.assertEqual(vaultInfoAfter);
//   });

//   it("InitSolend: Can re-initialize protocol after delete_* instruction", async () => {
//     const solend = new SolendProtocol(vault1, program, connection);
//     await solend.initialize(program);
//     vault1.protocols.push(solend);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     await instr.initSolend(vault1);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     const vaultInfoAfterInit = await program.account.vaultInfo.fetch(
//         vault1.vaultInfo
//     );
//     vault1.assertEqual(vaultInfoAfterInit);

//     // delete account, assert balance is stale
//     assert(solend.lastUpdate.stale);  // double check that we're checking that balance IS stale
//     const txn = new anchor.web3.Transaction();
//     txn.add(instr.getBalanceSolendInstr(vault1));
//     txn.add(instr.deleteSolendInstr(vault1));
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     await program.provider.send(txn, [vault1.vaultCreator.keypair]);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction

//     const ctokenAccount = await solend.reserveCollateralMint.splToken.getAccountInfo(
//         vault1.getProtocol(UUID).destinationCollateral
//     );
//     assert(ctokenAccount.amount.isZero());

//     vault1.protocols = [];
//     const vaultInfoAfterDelete = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     vault1.assertEqual(vaultInfoAfterDelete);
//   });

//   it("SetDistribution: Failure: Length of arrays is too long", async () => {
//     // Initialize solend again
//     const solend = new SolendProtocol(vault1, program, connection);
//     await solend.initialize(program);
//     vault1.protocols.push(solend);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction
//     await instr.initSolend(vault1);
//     await u.sleep(1000); // make sure we wait till the next block before sending transaction

//     // locations
//     const locations = _.flatten([
//         u.convertStrToUint8(POOL_UUID),
//         vault1.protocols.map(p => p.uuid),
//         u.convertStrToUint8(SOLEND_UUID),
//     ]);
//     const res1 = await setDistribution(vault1, {locations}, true);
//     u.assertSimulationError(res1, [accrueErrors.SetDistributionLengthError]);

//     // distribution
//     const distribution = _.flatten([
//         vault1.pool.distribution,
//         vault1.protocols.map(p => p.distribution),
//         u.bn(0),
//       ]);
//     const res2 = await setDistribution(vault1, {distribution}, true);
//     u.assertSimulationError(res2, [accrueErrors.SetDistributionLengthError]);

//     // deposits_disabled
//     const depositsDisabled = _.flatten([
//         false,
//         vault1.protocols.map(p => p.depositsDisabled),
//         false,
//     ])
//     const res3 = await setDistribution(vault1, {depositsDisabled}, true);
//     u.assertSimulationError(res3, [accrueErrors.SetDistributionLengthError]);
//   });

//   it("SetDistribution: Failure: Length of arrays is too short", async () => {
//     // locations
//     const locations = _.flatten([u.convertStrToUint8(POOL_UUID)]);
//     const res1 = await setDistribution(vault1, {locations}, true);
//     u.assertSimulationError(res1, [accrueErrors.SetDistributionLengthError]);

//     // distribution
//     const distribution = _.flatten([u.U64_MAX]);
//     const res2 = await setDistribution(vault1, {distribution}, true);
//     u.assertSimulationError(res2, [accrueErrors.SetDistributionLengthError]);

//     // deposits_disabled
//     const depositsDisabled = _.flatten([false])
//     const res3 = await setDistribution(vault1, {depositsDisabled}, true);
//     u.assertSimulationError(res3, [accrueErrors.SetDistributionLengthError]);
//   });

//   it("SetDistribution: Non-unique UUIDs", async() => {
//     const locations = _.flatten([
//         u.convertStrToUint8(POOL_UUID),
//         u.convertStrToUint8(POOL_UUID),
//     ]);
//     const res = await setDistribution(vault1, {locations}, true);
//     u.assertSimulationError(res, [accrueErrors.SetDistributionDuplicateUuidError]);
//   });

//   it("SetDistribution: distribution doesn't sum to U64_MAX", async() => {
//     // low
//     const distribution1 = _.flatten([
//         u.U64_MAX.sub(u.bn(1)),
//         u.bn(0),
//     ]);
//     const res1 = await setDistribution(vault1, {distribution: distribution1}, true);
//     u.assertSimulationError(res1, [accrueErrors.SetDistributionSumError]);

//     // high
//     const distribution2 = _.flatten([
//         u.U64_MAX,
//         u.bn(1),
//     ]);
//     const res2 = await setDistribution(vault1, {distribution: distribution2}, true);
//     u.assertSimulationError(res2, [accrueErrors.OverflowError]);
//   });
// });
