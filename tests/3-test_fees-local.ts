// import * as anchor from '@project-serum/anchor';
// import * as spl from '@solana/spl-token';
// import _ from 'lodash';
// import * as chai from "chai";
// import * as chaiAsPromised from "chai-as-promised";
// import * as u from "./general/utils";
// import { Mint, User, Vault } from "./vault/classes";
// import * as instr from "./vault/instructions";
// import { depositPool, withdrawPool } from "./pool/instructions";
// import { Autopilot } from '../target/types/autopilot';

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
//     anchor.setProvider(anchor.Provider.env());
//     const program = anchor.workspace.Autopilot as anchor.Program<Autopilot>;
//     const connection = anchor.getProvider().connection;
//     const accrueErrors = {}
//     program.idl.errors.forEach(error => {
//         const errorName = error["name"];
//         accrueErrors[errorName] = error["code"];
//     });

//     const mintCreator = new User();  // doesnt need spl tokens so don't pass in mint
//     const vaultCreator = new User(null, new anchor.BN(1000), new anchor.BN(1));

//     // Interest Fee tests
//     const mint1 = Mint.createNew(program, connection, mintCreator, 9);
//     const vault1 = new Vault(mint1, vaultCreator, u.bn(1e6));
//     vault1.interestFee = u.U64_MAX.div(u.bn(2));  // 50%
//     vaultCreator.vault = vault1;  // vaultCreator creates vault1 and vault2, but set vaultCreator's default params to vault1
//     const citizen1 = new User(
//       vault1,
//       new anchor.BN(1000),  // originalMintAmount
//       new anchor.BN(50),    // DIFF: depositAmount
//     );

//     const hacker1 = new User(
//         vault1,
//         new anchor.BN(1000),  // originalMintAmount
//         new anchor.BN(7)      // depositAmount
//     );
  
//     const hacker1OwnedVault = new Vault(mint1, hacker1, u.bn(1e6));
//     // ^ This is just an extra vault with the same mint as vault1, but with hacker1 as the owner
//     //   hacker1.vault should NOT change to hacker1OwnedVault.

//     // Deposit withdraw fee tests
//     const mint2 = Mint.createNew(program, connection, mintCreator, 9);
//     const vault2 = new Vault(mint2, vaultCreator, u.bn(1e6));
//     vault2.depositFee = u.U64_MAX.div(u.bn(5));  // 20%
//     vault2.withdrawFee = u.U64_MAX.div(u.bn(2));  // 50%
//     const citizen2 = new User(
//       vault2,
//       new anchor.BN(1000),  // originalMintAmount
//       new anchor.BN(50),    // DIFF: depositAmount
//     );

//     // Interest fee and Deposit withdraw fee together tests
//     const mint3 = Mint.createNew(program, connection, mintCreator, 9);
//     const vault3 = new Vault(mint3, vaultCreator, u.bn(1e6));
//     vault3.interestFee = u.U64_MAX.div(u.bn(2));  // 50%
//     vault3.depositFee = u.U64_MAX.div(u.bn(5));  // 20%
//     vault3.withdrawFee = u.U64_MAX.div(u.bn(10));  // 10%
//     const citizen3 = new User(
//       vault3,
//       new anchor.BN(1000),  // originalMintAmount
//       new anchor.BN(50),    // DIFF: depositAmount
//     );

//     const users = [
//       mintCreator,
//       vaultCreator,
//       citizen1,
//       hacker1,
//       citizen2,
//       citizen3,
//     ];

//     const mints = [
//       mint1,
//       mint2,
//       mint3,
//     ]

//     const vaults = [
//       vault1,
//       hacker1OwnedVault,
//       vault2,
//       vault3,
//     ]

// 	before(async () => {
// 	  // Airdrop Lamports
// 	  await u.bulkAirdrop(connection, users);

// 	  // Create Mints, Token Accounts, and Vaults
// 	  await Promise.all(mints.map(mint => mint.initialize()));
// 	  await Promise.all(users.map(user => user.initialize()));
// 	  await Promise.all(vaults.map(vault => vault.initialize()));

// 	  // Initialize Vaults (and create accrue_mints)
// 	  await Promise.all(vaults.map(v => instr.initVault(v)));

// 	  // Create users' accrue mint token accounts
// 	  await Promise.all(
// 		users.map(user => user.initializeAccrueTokenAccount())
// 	  );
// 	});

//     async function assertFeeTest(citizen, expectedBalanceAfter, expectedAtokenSupplyAfter) {
//       const vaultInfoAfter = await program.account.vaultInfo.fetch(citizen.vault.vaultInfo);
//       assert(vaultInfoAfter.pool.lastUpdate.slot.gt(citizen.vault.pool.lastUpdate.slot));  // slot should have increased
//       citizen.vault.pool.balance = citizen.vault.balanceEstimate;
//       citizen.vault.pool.lastUpdate.stale = false;
//       citizen.vault.pool.lastUpdate.slot = vaultInfoAfter.pool.lastUpdate.slot;
//       citizen.vault.assertEqual(vaultInfoAfter);

//       const balanceAfter = (await citizen.vault.mint.splToken.getAccountInfo(citizen.mintTokenAccount)).amount;
//       assert(balanceAfter.eq(expectedBalanceAfter), `expected: ${expectedBalanceAfter.toNumber()} actual: ${balanceAfter.toNumber()}`);

//       const poolAmount = (await citizen.vault.mint.splToken.getAccountInfo(citizen.vault.pool.publicKey)).amount;
//       assert(poolAmount.eq(citizen.vault.pool.balance), `expected: ${citizen.vault.pool.balance.toNumber()}, actual: ${poolAmount.toNumber()}`);

//       const atokenSupplyAfter = (await citizen.vault.accrueMint.getMintInfo()).supply;
//       assert(atokenSupplyAfter.eq(expectedAtokenSupplyAfter), `expected: ${expectedAtokenSupplyAfter}, actual: ${atokenSupplyAfter}`);

//       const atokenAmountAfter = (await citizen.vault.accrueMint.getAccountInfo(citizen.accrueMintTokenAccount)).amount;
//       assert(atokenAmountAfter.eq(atokenSupplyAfter));
//     }
    

//     /************************************************************

//     INTEREST FEE

//     ************************************************************/

//     it("DepositPool – Interest Fee: Success: No balance before", async () => {
//         const citizenBalanceBefore = (await mint1.splToken.getAccountInfo(citizen1.mintTokenAccount)).amount;
//         const expectedBalanceAfter = citizenBalanceBefore.sub(citizen1.depositAmount);
//         const expectedAtokenSupplyAfter = u.bn(50);
//         vault1.balanceEstimate = u.bn(50);

//         await depositPool(citizen1);

//         await assertFeeTest(citizen1, expectedBalanceAfter, expectedAtokenSupplyAfter);
//     });

//     it("DepositPool – Interest Fee: Success: $100 interest accrued with 50% fee", async () => {
//         /*
//         Summary:
//         1. User deposited $50
//         2. $100 interest accrues
//         3. Interest fee is 50%, so $50 of interest

//         Final values:
//         - $50 user deposit
//         - $50 interest
//         - $50 fees
//         Total: $150
//         Then, user deposits another $100
//         */

//         // pre-check: assert supply and atoken amount are correct
//         const atokenSupplyBefore = (await vault1.accrueMint.getMintInfo()).supply;
//         assert(atokenSupplyBefore.eq(citizen1.depositAmount));
//         const atokenAmountBefore = (await vault1.accrueMint.getAccountInfo(citizen1.accrueMintTokenAccount)).amount;
//         assert(atokenAmountBefore.eq(atokenSupplyBefore));

//         const citizenBalanceBefore = (await mint1.splToken.getAccountInfo(citizen1.mintTokenAccount)).amount;
//         const expectedBalanceAfter = citizenBalanceBefore.sub(u.bn(100));
//         const expectedAtokenSupplyAfter = atokenSupplyBefore.add(u.bn(49));  // there was 101 in the pool and we deposited $50, so mint (50 * 100 / 101) = 49.xx
//         vault1.balanceEstimate = u.bn(150 + 100);  // $150 before + $100 user deposit
//         vault1.collectibleFee = u.bn(49);  // $100 interest has accrued with a 50% interest fee

//         // accrue $100 of interest
//         await vault1.accrueInterest(100);

//         await depositPool(citizen1, {
//             depositAmount: u.bn(100),
//         });

//         await assertFeeTest(citizen1, expectedBalanceAfter, expectedAtokenSupplyAfter);        
//     })

//     it("WithdrawPool – Interest Fee: Success: $250 interest accrued with 50% fee", async () => {
//         /*
//         Summary:
//         1. Already had $250 in pool
//         2. $250 interest accrues
//         3. Interest fee is 50% -> $125 fees added

//         Final values:
//         - $150 user deposits
//         - $177 interest ($500 - $150 - $173)
//         - $173 fees ($49 + $124). The $124 is because flooring. Our 50% fee is actually. 49.999...%
//         Total: $500
//         Then, user withdraws ~50% of pool (49 of all 99 aTokens), so (49/99) * ($150 + $177) = $161.84 => $161
//         */

//         // pre-check: assert supply and atoken amount are correct
//         const atokenSupplyBefore = (await vault1.accrueMint.getMintInfo()).supply;
//         assert(atokenSupplyBefore.eq(u.bn(99)));
//         const atokenAmountBefore = (await vault1.accrueMint.getAccountInfo(citizen1.accrueMintTokenAccount)).amount;
//         assert(atokenAmountBefore.eq(atokenSupplyBefore));

//         const citizenBalanceBefore = (await mint1.splToken.getAccountInfo(citizen1.mintTokenAccount)).amount;
//         const expectedBalanceAfter = citizenBalanceBefore.add(u.bn(161));
//         const expectedAtokenSupplyAfter = u.bn(50);  // burned a49 of a99

//         vault1.balanceEstimate = u.bn(500 - 161);  // $500 before - $161 withdraw
//         vault1.collectibleFee = u.bn(173);  // $250 interest has accrued with a 50% interest fee

//         // accrue $250 of interest
//         await vault1.accrueInterest(250);

//         // withdraw half of aTokens => a49.5 => a49 => $163
//         await withdrawPool(citizen1, {
//             withdrawAmount: atokenAmountBefore.div(u.bn(2)),
//         });

//         await assertFeeTest(citizen1, expectedBalanceAfter, expectedAtokenSupplyAfter);
//     })

//     it("WithdrawPool – Interest Fee: Success: All remaining funds in pool", async () => {
//         const atokenSupplyBefore = (await vault1.accrueMint.getMintInfo()).supply;
//         const citizenBalanceBefore = (await mint1.splToken.getAccountInfo(citizen1.mintTokenAccount)).amount;
//         const expectedBalanceAfter = citizenBalanceBefore.add(u.bn(166));  // (pool before was 500 - 161), minus the 173 fees left in pool
//         const expectedAtokenSupplyAfter = u.bn(0);  // burned a49 of a99

//         vault1.balanceEstimate = u.bn(173);  // $173 of fees left

//         await withdrawPool(citizen1, {
//             withdrawAmount: atokenSupplyBefore,
//         });

//         await assertFeeTest(citizen1, expectedBalanceAfter, expectedAtokenSupplyAfter);
//     });

//     /************************************************************

//     DEPOSIT WITHDRAW FEE using vault2

//     ************************************************************/

//     it("DepositPool – Deposit Fee: Success: No balance before", async () => {
//         const citizenBalanceBefore = (await mint2.splToken.getAccountInfo(citizen2.mintTokenAccount)).amount;
//         const expectedBalanceAfter = citizenBalanceBefore.sub(citizen2.depositAmount);
//         const expectedAtokenSupplyAfter = u.bn(40);
//         vault2.balanceEstimate = u.bn(50);
//         vault2.collectibleFee = u.bn(10);

//         await depositPool(citizen2);

//         await assertFeeTest(citizen2, expectedBalanceAfter, expectedAtokenSupplyAfter);
//     });

//     it("DepositPool – Deposit Fee: Success: Balance before", async () => {
//         const citizenBalanceBefore = (await mint2.splToken.getAccountInfo(citizen2.mintTokenAccount)).amount;
//         const expectedBalanceAfter = citizenBalanceBefore.sub(citizen2.depositAmount);
//         const expectedAtokenSupplyAfter = u.bn(80); 
//         vault2.balanceEstimate = u.bn(100);
//         vault2.collectibleFee = u.bn(20);

//         await depositPool(citizen2);

//         await assertFeeTest(citizen2, expectedBalanceAfter, expectedAtokenSupplyAfter);
//     });

//     it("DepositPool – Withdraw Fee: Success: Balance before", async () => {
//       const citizenBalanceBefore = (await mint2.splToken.getAccountInfo(citizen2.mintTokenAccount)).amount;
//       const expectedBalanceAfter = citizenBalanceBefore.add(u.bn(21));
//       const expectedAtokenSupplyAfter = u.bn(40); 
//       vault2.balanceEstimate = u.bn(79);  // user withdraws $40 - 19 = 21
//       vault2.collectibleFee = u.bn(39);   // withdraw_fee = 19, so 20 + 19 = 39

//       await withdrawPool(citizen2, {
//           withdrawAmount: u.bn(40),
//       });  // withdraw half of aTokens (a40 = $40, with 50% withdraw fee => should get $20 back -- BUT flooring makes withdraw_fee = 19

//       await assertFeeTest(citizen2, expectedBalanceAfter, expectedAtokenSupplyAfter);
//     });

//     it("DepositPool – Withdraw Fee: Success: Remove all balance", async () => {
//         const citizenBalanceBefore = (await mint2.splToken.getAccountInfo(citizen2.mintTokenAccount)).amount;
//         const expectedBalanceAfter = citizenBalanceBefore.add(u.bn(21));
//         const expectedAtokenSupplyAfter = u.bn(0);
//         vault2.balanceEstimate = u.bn(79 - 21);  // user withdraws $40 - 19 = 21
//         vault2.collectibleFee = u.bn(39 + 19);

//         await withdrawPool(citizen2, {
//             withdrawAmount: u.bn(40),
//         });  // withdraw all aTokens (a40 = $40, with 50% withdraw fee => should get $20 back -- BUT flooring makes withdraw_fee = 19

//         await assertFeeTest(citizen2, expectedBalanceAfter, expectedAtokenSupplyAfter);
//     });

//     it("DepositPool – Interest and Deposit/Withdraw Fees: Success", async () => {
//       // vault3
//       // seed vault with money
//       const citizenBalanceBefore = (await mint3.splToken.getAccountInfo(citizen3.mintTokenAccount)).amount;
//       const expectedBalanceAfter = citizenBalanceBefore.sub(citizen3.depositAmount);
//       const expectedAtokenSupplyAfter = u.bn(40);
//       vault3.balanceEstimate = u.bn(50);
//       vault3.collectibleFee = u.bn(10);
//       await depositPool(citizen3);
//       await assertFeeTest(citizen3, expectedBalanceAfter, expectedAtokenSupplyAfter);

//       // accrue interest and withdraw all aTokens
//       // $50 pool with $10 fee -> $100 interest accrues so $150 pool with $60 fee
//       // and then user withdraws $150 - $60 = $90 of aTokens. We take a 10% on that (=$9, but flooring makes it $8)
//       // so the pool has $60 + $8 tokens of fees.
//       await vault3.accrueInterest(100);  // 50% fees, so user earns $50
//       vault3.balanceEstimate = u.bn(68);
//       vault3.collectibleFee = u.bn(68);
      
//       await withdrawPool(citizen3, {
//         withdrawAmount: expectedAtokenSupplyAfter,  // $50 + $40 withdraw with 10% fee -> $81
//       });
//       await assertFeeTest(citizen3, expectedBalanceAfter.add(u.bn(82)), u.bn(0));
//     });


//     /************************************************************

//     COLLECT FEES

//     ************************************************************/

//     it('CollectFees: Set up', async () => {
//         // seed some balance to make sure it doesn't disappear after
//         const citizenBalanceBefore = (await mint1.splToken.getAccountInfo(citizen1.mintTokenAccount)).amount;
//         const expectedBalanceAfter = citizenBalanceBefore.sub(citizen1.depositAmount);
//         const expectedAtokenSupplyAfter = u.bn(50);
//         vault1.balanceEstimate = vault1.balanceEstimate.add(u.bn(50));

//         await depositPool(citizen1);

//         await assertFeeTest(citizen1, expectedBalanceAfter, expectedAtokenSupplyAfter);
//     })

//     it("CollectFees: Failure: Constraint: vault_creator did not sign the transaction", async () => {
//         // No signers
//         await chai.expect(
//           // NOTE: not a simulation because `simulate` doesn't check signers
//           instr.collectFees(vaultCreator, {
//             signers: []
//           })
//         ).to.be.rejectedWith("Signature verification failed");
  
//         // Wrong signers
//         await chai.expect(
//           // NOTE: not a simulation because `simulate` doesn't check signers
//           instr.collectFees(vaultCreator, {
//             signers: [hacker1.keypair]
//           })
//         ).to.be.rejectedWith(`unknown signer: ${hacker1.publicKey}`);
//       });
  
//       it('CollectFees: Failure: Constraint: vault_info is not owned by program', async () => {
//         const res = await instr.collectFees(
//           vaultCreator,
//           {
//               vaultInfo: vaultCreator.mintTokenAccount 
//           },
//           true,
//         );
//         u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//       });

//     it('CollectFees: Failure: Constraint: pool has wrong mint or creator', async () => {
//         // wrong mint
//         const res1 = await instr.collectFees(vaultCreator, {
//             pool: vault2.pool.publicKey,
//         }, true);
//         u.assertSimulationError(res1, ["PrivilegeEscalation", "ProgramFailedToComplete", 2006]);

//         // wrong creator
//         const res2 = await instr.collectFees(vaultCreator, {
//             pool: hacker1OwnedVault.pool.publicKey,
//         }, true);
//         u.assertSimulationError(res2, ["PrivilegeEscalation", "ProgramFailedToComplete", 2006]);
//     });

//     it('CollectFees: Failure: Constraint: fee_collector_account is not is not owned by token program', async () => {
//         const res = await instr.collectFees(vaultCreator, {
//             feeCollectionAccount: vaultCreator.publicKey,
//         }, true);
//         u.assertSimulationError(res, [3007]);
//     });

//     it('CollectFees: Failure: Constraint: program was wrong', async () => {
//         // Token Program
//         const res2 = await instr.collectFees(vaultCreator, { tokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID }, true)
//         u.assertSimulationError(res2, [3008]);  // InvalidProgramId
  
//         // Clock Program
//         const res3 = await instr.collectFees(vaultCreator, { clock: anchor.web3.SystemProgram.programId }, true);
//         u.assertSimulationError(res3, ["InvalidArgument"]);
//       });
  
//     it('CollectFees: Failure: vault_creator did not create this vault', async () => {
//         const res = await instr.collectFees(
//           vaultCreator,
//           {
//             vaultCreator: hacker1.publicKey,
//             signers: [hacker1.keypair],
//           },
//           true
//         );
//         u.assertSimulationError(res, [accrueErrors.VaultCreatorOwnershipError]);
//     });

//     it('CollectFees: Success', async () => {
//       // accrue interest to make sure that collect_fees will check for it
//       await vault1.accrueInterest(100);  // 50% interest fee -> 49 interest with flooring
//       vault1.balanceEstimate = vault1.balanceEstimate.add(u.bn(100));
//       vault1.collectibleFee = vault1.collectibleFee.add(u.bn(49));

//       // pull out all fees into citizen's account
//       const citizenBalanceBefore = (await mint1.splToken.getAccountInfo(citizen1.mintTokenAccount)).amount;
//       const expectedBalanceAfter = citizenBalanceBefore.add(vault1.collectibleFee);  // should've gotten back just the collectible fee amt
//       const expectedAtokenSupplyAfter = (await vault1.accrueMint.getMintInfo()).supply;
//       vault1.balanceEstimate = vault1.balanceEstimate.sub(vault1.collectibleFee);
//       vault1.collectibleFee = u.bn(0);

//       await instr.collectFees(vaultCreator, {
//         feeCollectionAccount: citizen1.mintTokenAccount,
//       });

//       await assertFeeTest(citizen1, expectedBalanceAfter, expectedAtokenSupplyAfter);
//     });
//   });
