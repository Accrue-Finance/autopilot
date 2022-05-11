// import * as anchor from '@project-serum/anchor';
// import * as spl from '@solana/spl-token';
// import _ from 'lodash';
// import * as chai from "chai";
// import * as chaiAsPromised from "chai-as-promised";
// import * as u from "./general/utils";
// import { Mint, User, Vault } from "./vault/classes";
// import * as instr from "./vault/instructions";
// import { depositPool, depositPoolInstr } from "./pool/instructions";
// import { Autopilot } from '../target/types/autopilot';
// import { SolendProtocol } from './protocols/solend/classes';
// import { deleteSolendInstr, getBalanceSolendInstr, initSolend, rebalanceSolendInstr, withdrawSolend, withdrawSolendInstr } from './protocols/solend/instructions';
// import { SOL_DEVNET } from './general/accounts';
// import { PublicKey } from '@solana/web3.js';

// const { assert } = chai;
// chai.use(chaiAsPromised.default);

// /*
// IMPORTANT INFORMATION

// This set of tests only checks the vault/ and pool/ instructions. It is not full coverage
// for all these tests, as some vault/ and pool/ tests require one other protocol to be created.
// To see all test cases for these instructions, navigate to the other files.

// When you're writing a test, make sure you isolate the variable you are testing.
// E.g. Test it("depositor_token_account must have same mint as depositor", ...) should ONLY
// have the mint as different. The owner of depositor_token_account should be depositor.
// Sometimes, this will get tough. But it's worth it.
// */

// describe('fees', () => {
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
//   vault1.interestFee = u.U64_MAX.div(u.bn(2));
//   vault1.withdrawFee = u.U64_MAX.div(u.bn(5));
//   vaultCreator.vault = vault1; // vaultCreator creates vault1 and vault2, but set vaultCreator's default params to vault1
//   const citizen1 = new User(
//     vault1,
//     new anchor.BN(1000), // originalMintAmount
//     new anchor.BN(50) // depositAmount
//   );
//   const hacker1 = new User(
//     vault1,
//     new anchor.BN(1000), // originalMintAmount
//     new anchor.BN(50) // depositAmount
//   );

//   const hacker1OwnedVault = new Vault(mint1, hacker1, u.bn(1e6));
//   // ^ This is just an extra vault with the same mint as vault1, but with hacker1 as the owner
//   //   hacker1.vault should NOT change to hacker1OwnedVault.


//   const users = [
//     mintCreator,
//     vaultCreator,
//     citizen1,
//     hacker1,
//   ];

//   const mints = [mint1];

//   const vaults = [vault1, hacker1OwnedVault];

//   before(async () => {
//     // Airdrop Lamports
//     await u.bulkAirdrop(connection, users);

//     // Create Mints, Token Accounts, and Vaults
//     await Promise.all(mints.map((mint) => mint.initialize()));
//     await Promise.all(users.map((user) => user.initialize()));
//     await Promise.all(vaults.map((vault) => vault.initialize()));

//     // Initialize Vaults (and create accrue_mints)
//     await Promise.all(vaults.map((v) => instr.initVault(v)));

//     // Create users' accrue mint token accounts
//     await Promise.all(users.map((user) => user.initializeAccrueTokenAccount()));

//     // DIFF: Initialize Solend for all vaults
//     for (let i = 0; i < vaults.length; i++) {
//       const solend = new SolendProtocol(vaults[i], program, connection);
//       await solend.initialize(program);
//       vaults[i].protocols.push(solend);
//     }

//     // DIFF: initSolend for all vaults
//     await Promise.all(vaults.map((v) => initSolend(v)));
//   });


//     async function assertFeeTest(citizen, expectedBalanceAfter, expectedAtokenSupplyAfter, extra: Object = {}) {
//         const vaultInfoAfter = await program.account.vaultInfo.fetch(citizen.vault.vaultInfo);
//         // assert(vaultInfoAfter.pool.lastUpdate.slot.gt(citizen.vault.pool.lastUpdate.slot));  // slot should have increased
//         // citizen.vault.pool.balance = citizen.vault.balanceEstimate;
//         // citizen.vault.pool.lastUpdate.stale = false;
//         // citizen.vault.pool.lastUpdate.slot = vaultInfoAfter.pool.lastUpdate.slot;

//         if (citizen.vault.protocols.length !== 0) {
//             const lastUpdate = citizen.vault.protocols[0].lastUpdate;
//             lastUpdate.slot = vaultInfoAfter.pool.lastUpdate.slot;
//             lastUpdate.stale = false;
//         }

//         citizen.vault.assertEqual(vaultInfoAfter);

//         const balanceAfter = (await citizen.vault.mint.splToken.getAccountInfo(citizen.mintTokenAccount)).amount;
//         assert(balanceAfter.eq(expectedBalanceAfter), `expected: ${expectedBalanceAfter.toNumber()} actual: ${balanceAfter.toNumber()}`);

//         const poolAmount = (await citizen.vault.mint.splToken.getAccountInfo(citizen.vault.pool.publicKey)).amount;
//         if (extra.hasOwnProperty("freshPoolBalance")) {  // if balance is stale
//             assert(poolAmount.eq(extra.freshPoolBalance), `expected: ${extra.freshPoolBalance.toNumber()}, actual: ${poolAmount.toNumber()}`);
//         } else {
//             assert(poolAmount.eq(citizen.vault.pool.balance), `expected: ${citizen.vault.pool.balance.toNumber()}, actual: ${poolAmount.toNumber()}`);
//         }
        

//         const atokenSupplyAfter = (await citizen.vault.accrueMint.getMintInfo()).supply;
//         assert(atokenSupplyAfter.eq(expectedAtokenSupplyAfter), `expected: ${expectedAtokenSupplyAfter}, actual: ${atokenSupplyAfter}`);

//         const atokenAmountAfter = (await citizen.vault.accrueMint.getAccountInfo(citizen.accrueMintTokenAccount)).amount;
//         assert(atokenAmountAfter.eq(atokenSupplyAfter));
//     }

//     it("CollectFees: Failure: Location is stale", async () => {
//         const res = await instr.collectFees(vaultCreator, {}, true);
//         u.assertSimulationError(res, [accrueErrors.LocationStaleError]);
//     });

//     it("WithdrawSolend – Fees: Success", async () => {
//       // seed vault with money
//       const citizenBalanceBefore = (await mint1.splToken.getAccountInfo(citizen1.mintTokenAccount)).amount;
//       const expectedBalanceAfter = citizenBalanceBefore.sub(citizen1.depositAmount);
//       const expectedAtokenSupplyAfter = u.bn(50);
//       vault1.balanceEstimate = u.bn(50);
//       const txn0 = new anchor.web3.Transaction();
//       txn0.add(getBalanceSolendInstr(vault1));
//       txn0.add(depositPoolInstr(citizen1));
//       vault1.pool.lastUpdate.stale = false;
//       await u.sleep(500);  // wait till next block
//       await program.provider.send(txn0, [citizen1.keypair]);
//       await u.sleep(500);  // wait till next block
//       vault1.pool.lastUpdate.slot = (await program.account.vaultInfo.fetch(vault1.vaultInfo)).pool.lastUpdate.slot;
//       vault1.pool.balance = vault1.balanceEstimate;  // pool has all funds
//       await assertFeeTest(citizen1, expectedBalanceAfter, expectedAtokenSupplyAfter);

//       // move funds into solend
//       console.log("TXN1")
//       vault1.pool.distribution = u.bn(0);
//       vault1.protocols[0].distribution = u.U64_MAX;
//       const txn1 = new anchor.web3.Transaction();
//       txn1.add(instr.setDistributionInstr(vault1));
//       txn1.add(getBalanceSolendInstr(vault1));
//       txn1.add(rebalanceSolendInstr(vault1));
//       txn1.add(getBalanceSolendInstr(vault1));
//       await u.sleep(500);  // wait till next block
//       await program.provider.send(txn1, [vault1.vaultCreator.keypair]);
//       vault1.pool.balance = u.bn(50);  // stale
//       vault1.pool.lastUpdate.slot = (await program.account.vaultInfo.fetch(vault1.vaultInfo)).pool.lastUpdate.slot;
//       vault1.pool.lastUpdate.stale = true;
//       vault1.protocols[0].balance = vault1.balanceEstimate.sub(u.bn(1));  // flooring
//       await assertFeeTest(citizen1, expectedBalanceAfter, expectedAtokenSupplyAfter, {
//           freshPoolBalance: u.bn(0),  // balance is stale, so check this one for actual balance
//       });

//       // accrue $100 interest and withdraw all
//       // fees: $50 - $1 (floor) on interest so $101 available for withdraw. 20% withdraw fee, so $80 withdrawn (flooring makes it $81)
//       await vault1.pool.accrueInterestXfer(mint1, hacker1, 100);
      
//       //   vault1.pool.balance has not changed, because vault is still staleee
//       vault1.protocols[0].balance = u.bn(49);  // 50 - 1 (flooring on depositing into solend)
//       await assertFeeTest(citizen1, expectedBalanceAfter, expectedAtokenSupplyAfter, {
//         freshPoolBalance: u.bn(100),  // balance is stale, so check this one for actual balance
//       });

//       // move interest into solend
//       console.log("TXN2")
//       const txn2 = new anchor.web3.Transaction();
//       txn2.add(getBalanceSolendInstr(vault1));
//       txn2.add(rebalanceSolendInstr(vault1));
//       txn2.add(getBalanceSolendInstr(vault1));
//       await u.sleep(500);  // wait till next block
//       await program.provider.send(txn2, [vault1.vaultCreator.keypair]);
//       await u.sleep(500);  // wait till next block
//       vault1.pool.balance = u.bn(100);  // right before we actually rebalance, we have the 100 interest
//       vault1.pool.lastUpdate.slot = (await program.account.vaultInfo.fetch(vault1.vaultInfo)).pool.lastUpdate.slot;
//       vault1.pool.lastUpdate.stale = true;
//       vault1.protocols[0].balance = u.bn(148);  // deposit twice, so floored twice. 150 - 1 -1
//       await assertFeeTest(citizen1, expectedBalanceAfter, expectedAtokenSupplyAfter, {
//         freshPoolBalance: u.bn(0),  // balance is stale, so check this one for actual balance
//       });

//       // withdraw all aTokens from solend
//       console.log("TXN3")
//       const txn3 = new anchor.web3.Transaction();
//       txn3.add(getBalanceSolendInstr(vault1));
//       txn3.add(withdrawSolendInstr(citizen1, {
//         withdrawAmount: expectedAtokenSupplyAfter,  
//         // $148 total balance, $49 fees on interest accrued puts us at $99 withdrawable
//         // $19 withdraw fee for $99, so user gets $80 back
//         // $148 - $80 = 68
//       }));
//       txn3.add(getBalanceSolendInstr(vault1));
//       await u.sleep(500);  // wait till next block
//       await program.provider.send(txn3, [citizen1.keypair]);
//       await u.sleep(500);  // wait till next block
//       vault1.pool.balance = u.bn(0);
//       vault1.pool.lastUpdate.slot = (await program.account.vaultInfo.fetch(vault1.vaultInfo)).pool.lastUpdate.slot;
//       vault1.pool.lastUpdate.stale = false;
//       vault1.collectibleFee = u.bn(68);  // $48 fees on interest ($50 - floor: $2) + 20% withdraw fee on ~$100 => $48 + $20
//       vault1.balanceEstimate = u.bn(69); // truth
//       vault1.protocols[0].balance = vault1.balanceEstimate;
//       await assertFeeTest(citizen1, expectedBalanceAfter.add(u.bn(79)), u.bn(0));  // $149 - $68 of fees = 

//       // move funds back into pool and do checks
//       console.log("TXN4")
//       vault1.pool.distribution = u.U64_MAX;
//       vault1.protocols[0].distribution = u.bn(0);
//       const txn4 = new anchor.web3.Transaction();
//       txn4.add(instr.setDistributionInstr(vault1));
//       txn4.add(getBalanceSolendInstr(vault1));
//       txn4.add(rebalanceSolendInstr(vault1));
//       txn4.add(getBalanceSolendInstr(vault1));
//       txn4.add(deleteSolendInstr(vault1));
//       vault1.protocols = [];  // remove protocol entirely
//       await u.sleep(500);  // wait till next block
//       await program.provider.send(txn4, [vault1.vaultCreator.keypair]);
//       await u.sleep(500);  // wait till next block
//       vault1.pool.balance = u.bn(0);  // before funds are moved back into pool
//       vault1.pool.lastUpdate.slot = (await program.account.vaultInfo.fetch(vault1.vaultInfo)).pool.lastUpdate.slot;
//       vault1.pool.lastUpdate.stale = true;
//       await assertFeeTest(citizen1, expectedBalanceAfter.add(u.bn(79)), u.bn(0), {
//         freshPoolBalance: u.bn(69)
//       });
//     });
// });