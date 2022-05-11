// import * as anchor from "@project-serum/anchor";
// import * as spl from "@solana/spl-token";
// import _ from "lodash";
// import * as chai from "chai";
// import * as chaiAsPromised from "chai-as-promised";
// import * as u from "./general/utils";
// import { Mint, User, Vault } from "./vault/classes";
// import * as instr from "./vault/instructions";
// import { SOLEND_UUID } from "./protocols/solend/classes";
// import { Autopilot } from "../target/types/autopilot";

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

// describe("vault", () => {
//   anchor.setProvider(anchor.Provider.env());
//   const program = anchor.workspace.Autopilot as anchor.Program<Autopilot>;
//   const connection = anchor.getProvider().connection;
//   const accrueErrors = {};
//   program.idl.errors.forEach((error) => {
//     const errorName = error["name"];
//     accrueErrors[errorName] = error["code"];
//   });

//   const mintCreator = new User(); // doesnt need spl tokens so don't pass in mint
//   const vaultCreator = new User(null, new anchor.BN(1000), new anchor.BN(1));

//   // Mint 1: Has no possibility of reaching vault max or overflow, so we can assign tokens carelessly to all accounts
//   // Make sure to use low numbers so we never run into supply max problem!
//   // Vault max should be far greater than users' token acc balances, which should be far greater than users' deposit amounts
//   const mint1 = Mint.createNew(program, connection, mintCreator, 9);
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

//   // Mint 2: Used to test overflow and vault_max checks mainly.
//   const mint2 = Mint.createNew(program, connection, mintCreator, 6);
//   const vault2 = new Vault(
//     mint2,
//     vaultCreator,
//     u.U64_MAX.sub(new anchor.BN(100000))
//   );
//   // ^ vault2 MUST be created by vault1.vaultCreator. Tests rely on that fact
//   const hacker2 = new User(
//     vault2,
//     u.U64_MAX.sub(new anchor.BN(1)), // originalMintAmount
//     u.U64_MAX.div(new anchor.BN(3)) // depositAmount
//   );
//   const citizen2 = new User(
//     vault2,
//     new anchor.BN(1), // originalMintAmount
//     new anchor.BN(1) // depositAmount
//   );

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
//   });

//   /************************************************************

//     INIT_VAULT

//     ************************************************************/

//   it("InitVault: Failure: Constraint: vault_creator did not sign txn!", async () => {
//     // No signers
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.initVault(vault1, {
//           signers: [],
//         })
//       )
//       .to.be.rejectedWith("Signature verification failed");

//     // Wrong signer
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.initVault(vault1, {
//           signers: [hacker1.keypair],
//         })
//       )
//       .to.be.rejectedWith(
//         `unknown signer: ${hacker1.publicKey}`,
//         "Wrong signer passed but txn succeeded"
//       );
//   });

//   it("InitVault: Failure: Constraint: vault_info has wrong mint or creator", async () => {
//     // wrong mint
//     const res1 = await instr.initVault(
//       vault1,
//       {
//         vaultInfo: vault2.vaultInfo,
//       },
//       true
//     );
//     u.assertSimulationError(res1, [
//       "PrivilegeEscalation",
//       "ProgramFailedToComplete",
//       2006,
//     ]);

//     // wrong creator
//     const res2 = await instr.initVault(
//       vault1,
//       {
//         vaultInfo: hacker1OwnedVault.vaultInfo,
//       },
//       true
//     );
//     u.assertSimulationError(res2, [
//       "PrivilegeEscalation",
//       "ProgramFailedToComplete",
//       2006,
//     ]);
//   });

//   it("InitVault: Failure: Constraint: pool has wrong mint or creator", async () => {
//     // wrong mint
//     const res1 = await instr.initVault(
//       vault1,
//       {
//         pool: vault2.pool.publicKey,
//       },
//       true
//     );
//     u.assertSimulationError(res1, [
//       "PrivilegeEscalation",
//       "ProgramFailedToComplete",
//       2006,
//     ]);

//     // wrong creator
//     const res2 = await instr.initVault(
//       vault1,
//       {
//         pool: hacker1OwnedVault.pool.publicKey,
//       },
//       true
//     );
//     u.assertSimulationError(res2, [
//       "PrivilegeEscalation",
//       "ProgramFailedToComplete",
//       2006,
//     ]);
//   });

//   it("InitVault: Failure: Constraint: mint is not owned by token program", async () => {
//     const res = await instr.initVault(
//       vault1,
//       {
//         mint: hacker1.publicKey,
//       },
//       true
//     );
//     u.assertSimulationError(res, [3007]); // AccountOwnedByWrongProgram
//   });

//   it("InitVault: Failure: Constraint: accrue_mint has wrong mint or creator", async () => {
//     // wrong mint
//     const res1 = await instr.initVault(
//       vault1,
//       {
//         accrueMint: vault2.accrueMint.publicKey,
//       },
//       true
//     );
//     u.assertSimulationError(res1, [
//       "PrivilegeEscalation",
//       "ProgramFailedToComplete",
//     ]);

//     // wrong creator
//     const res2 = await instr.initVault(
//       vault1,
//       {
//         accrueMint: hacker1OwnedVault.accrueMint.publicKey,
//       },
//       true
//     );
//     u.assertSimulationError(res2, [
//       "PrivilegeEscalation",
//       "ProgramFailedToComplete",
//       2006,
//     ]);
//   });

//   it("InitVault: Failure: Constraint: program was wrong", async () => {
//     // System Program
//     const res1 = await instr.initVault(
//       vault1,
//       { systemProgram: anchor.web3.SYSVAR_RENT_PUBKEY },
//       true
//     );
//     u.assertSimulationError(res1, [3008]); // InvalidProgramId

//     // Token Program
//     const res2 = await instr.initVault(
//       vault1,
//       { tokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID },
//       true
//     );
//     u.assertSimulationError(res2, [3008]); // InvalidProgramId

//     // Rent Program
//     const res3 = await instr.initVault(
//       vault1,
//       { rent: anchor.web3.SystemProgram.programId },
//       true
//     );
//     u.assertSimulationError(res3, ["InvalidArgument"]);
//   });

//   it("InitVault: Failure: client is not system program", async () => {
//     const res = await instr.initVault(
//       vaults[0],
//       {
//         client: anchor.web3.Keypair.generate().publicKey,
//       },
//       true
//     );
//     u.assertSimulationError(res, [accrueErrors.ClientAuthorityError]);
//   });

//   it("InitVault: Success - initialized all vaults", async () => {
//     // make sure at least two of the vaults' mints have different number of decimals
//     // so that we're checking decimals
//     const decimalsSeen = new Set();
//     vaults.forEach((vault) => decimalsSeen.add(vault.mint.decimals));
//     assert(decimalsSeen.size > 1);

//     // fees check - make sure initVault actually sets the values
//     vaults[0].depositFee = u.bn(1);
//     vaults[0].withdrawFee = u.bn(7);
//     vaults[0].interestFee = u.bn(5);

//     for (let i = 0; i < vaults.length; i++) {
//       const vault = vaults[i];

//       const payerBalanceBefore = (
//         await connection.getAccountInfo(vault.vaultCreator.publicKey)
//       ).lamports;

//       await instr.initVault(vault);

//       // vault_creator
//       const payerBalanceAfter = (
//         await connection.getAccountInfo(vault.vaultCreator.publicKey)
//       ).lamports;
//       assert(payerBalanceBefore > payerBalanceAfter);

//       // vault_info
//       await u.assertAccountDetailsAreCorrect(
//         connection,
//         vault.vaultInfo,
//         program.programId,
//         1435
//       );
//       const vaultInfo = await program.account.vaultInfo.fetch(vault.vaultInfo);
//       vault.assertEqual(vaultInfo);

//       // pool
//       await u.assertAccountDetailsAreCorrect(
//         connection,
//         vault.pool.publicKey,
//         spl.TOKEN_PROGRAM_ID,
//         165
//       );
//       const pool = await vault.mint.splToken.getAccountInfo(
//         vault.pool.publicKey
//       );
//       assert(pool.mint.equals(vault.mint.splToken.publicKey));
//       assert(pool.owner.equals(vault.pool.publicKey));
//       assert(pool.amount.isZero());

//       // accrue_mint
//       await u.assertAccountDetailsAreCorrect(
//         connection,
//         vault.accrueMint.publicKey,
//         spl.TOKEN_PROGRAM_ID,
//         82
//       );
//       const mint = await vault.mint.splToken.getMintInfo();
//       const accrueMint = await vault.accrueMint.getMintInfo();
//       assert(accrueMint.decimals == mint.decimals);
//       assert(accrueMint.freezeAuthority.equals(vault.accrueMint.publicKey));
//       assert(accrueMint.mintAuthority.equals(vault.accrueMint.publicKey));
//       assert(accrueMint.isInitialized);
//       assert(accrueMint.supply.isZero());
//     }
//   });

//   it("InitVault: Success: cluster is not 0", async () => {
//     const tempMint = Mint.createNew(program, connection, mintCreator, 9);
//     await tempMint.initialize();
//     const tempVault = new Vault(tempMint, vaultCreator, u.bn(1e6));
//     await tempVault.initialize();
//     tempVault.cluster = 1;

//     // cluster = 2 (should fail)
//     const res1 = await instr.initVault(
//       tempVault,
//       {
//         cluster: 2,
//       },
//       true
//     );
//     u.assertSimulationError(res1, [accrueErrors.ProtocolClusterInvalidError]);

//     // cluster = 1 (should succeed)
//     await instr.initVault(tempVault);
//     const newVaultInfo = await program.account.vaultInfo.fetch(
//       tempVault.vaultInfo
//     );
//     tempVault.assertEqual(newVaultInfo);
//     assert(newVaultInfo.cluster === 1); // double check
//   });

//   it("InitVault: Failure: Cannot call this instuction again with same params", async () => {
//     const res = await instr.initVault(vaults[0], {}, true);
//     u.assertSimulationError(res, [0]);
//   });

//   /************************************************************

//     CHANGE VAULT INFO

//     *************************************************************/

//   it("ChangeVaultInfo: Failure: Constraint: vault_creator did not sign the transaction", async () => {
//     // No signers
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.changeVaultInfo(vault1, {
//           signers: [],
//         })
//       )
//       .to.be.rejectedWith("Signature verification failed");

//     // Wrong signers
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.changeVaultInfo(vault1, {
//           signers: [hacker1.keypair],
//         })
//       )
//       .to.be.rejectedWith(`unknown signer: ${hacker1.publicKey}`);
//   });

//   it("ChangeVaultInfo: Failure: Constraint: vault_info is not owned by program", async () => {
//     const res = await instr.changeVaultInfo(
//       vault1,
//       {
//         vaultInfo: hacker1.mintTokenAccount,
//       },
//       true
//     );
//     u.assertSimulationError(res, [3007]); // AccountOwnedByWrongProgram
//   });

//   it("ChangeVaultInfo: Failure: vault_creator did not create this vault", async () => {
//     const res = await instr.changeVaultInfo(
//       vault1,
//       {
//         vaultCreator: hacker1.publicKey,
//         signers: [hacker1.keypair],
//       },
//       true
//     );
//     u.assertSimulationError(res, [accrueErrors.VaultCreatorOwnershipError]);
//   });

//   it("ChangeVaultInfo: Success", async () => {
//     const oldVaultMax = (
//       await program.account.vaultInfo.fetch(vault1.vaultInfo)
//     ).vaultMax;
//     assert(oldVaultMax.eq(vault1.vaultMax));
//     assert(oldVaultMax.lt(u.U64_MAX)); // need space to increase vault max
//     vault1.protocolsMax += 1;
//     vault1.version -= 1;
//     vault1.vaultMax = vault1.vaultMax.add(u.bn(1));
//     vault1.depositFee = vault1.depositFee.add(u.bn(1));
//     vault1.withdrawFee = vault1.withdrawFee.add(u.bn(1));
//     vault1.interestFee = vault1.interestFee.add(u.bn(1));
//     vault1.userDepositsDisabled = true;
//     vault1.userWithdrawsDisabled = true;

//     await instr.changeVaultInfo(vault1);

//     const vaultInfoAfter = await program.account.vaultInfo.fetch(
//       vault1.vaultInfo
//     );
//     vault1.assertEqual(vaultInfoAfter);

//     // clean up vault max
//     vault1.vaultMax = oldVaultMax;
//     await instr.changeVaultInfo(vault1, {
//       newVaultMax: oldVaultMax,
//     });
//   });

//   /************************************************************

//     SET DISTRIBUTION

//     *************************************************************/

//   it("SetDistribution: Failure: Constraint: vault_creator did not sign the transaction", async () => {
//     // No signers
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.setDistribution(vault1, {
//           signers: [],
//         })
//       )
//       .to.be.rejectedWith("Signature verification failed");

//     // Wrong signers
//     await chai
//       .expect(
//         // NOTE: not a simulation because `simulate` doesn't check signers
//         instr.setDistribution(vault1, {
//           signers: [hacker1.keypair],
//         })
//       )
//       .to.be.rejectedWith(`unknown signer: ${hacker1.publicKey}`);
//   });

//   it("SetDistribution: Failure: Constraint: vault_info is not owned by program", async () => {
//     const res = await instr.setDistribution(
//       vault1,
//       {
//         vaultInfo: hacker1.mintTokenAccount,
//       },
//       true
//     );
//     u.assertSimulationError(res, [3007]); // AccountOwnedByWrongProgram
//   });

//   it("SetDistribution: Failure: vault_creator did not create this vault", async () => {
//     const res = await instr.setDistribution(
//       vault1,
//       {
//         vaultCreator: hacker1.publicKey,
//         signers: [hacker1.keypair],
//       },
//       true
//     );
//     u.assertSimulationError(res, [accrueErrors.VaultCreatorOwnershipError]);
//   });

//   it("SetDistribution: Failure: pool uuid is missing", async () => {
//     const locations = _.flatten([u.convertStrToUint8(SOLEND_UUID)]);
//     const res = await instr.setDistribution(vault1, { locations }, true);
//     u.assertSimulationError(res, [
//       accrueErrors.SetDistributionMissingPoolError,
//     ]);
//   });
// });
