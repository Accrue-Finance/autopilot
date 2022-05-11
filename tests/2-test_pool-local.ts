// import * as anchor from '@project-serum/anchor';
// import * as spl from '@solana/spl-token';
// import _ from 'lodash';
// import * as chai from "chai";
// import * as chaiAsPromised from "chai-as-promised";
// import * as u from "./general/utils";
// import { Mint, User, Vault } from "./vault/classes";
// import { changeVaultInfo, initVault } from "./vault/instructions";
// import * as instr from "./pool/instructions";
// import { Autopilot } from '../target/types/autopilot';
// import { parseIdlErrors } from '@project-serum/anchor';
// const { assert } = chai;
// chai.use(chaiAsPromised.default);

// describe('pool', () => {
//     anchor.setProvider(anchor.Provider.env());
//     const program = anchor.workspace.Autopilot as anchor.Program<Autopilot>;
//     const connection = anchor.getProvider().connection;
// 	const accrueErrors = {}
//     program.idl.errors.forEach(error => {
//         const errorName = error["name"];
//         accrueErrors[errorName] = error["code"];
//     });

// 	const mintCreator = new User();  // doesnt need spl tokens so don't pass in mint
// 	const vaultCreator = new User(null, new anchor.BN(1000), new anchor.BN(1));

// 	// Mint 1: Has no possibility of reaching vault max or overflow, so we can assign tokens carelessly to all accounts
// 	// Make sure to use low numbers so we never run into supply max problem!
// 	// Vault max should be far greater than users' token acc balances, which should be far greater than users' deposit amounts
// 	const mint1 = Mint.createNew(program, connection, mintCreator, 9);
// 	const vault1 = new Vault(mint1, vaultCreator, u.bn(1e6));
// 	vaultCreator.vault = vault1;  // vaultCreator creates vault1 and vault2, but set vaultCreator's default params to vault1
// 	const citizen1 = new User(
// 	  vault1,
// 	  new anchor.BN(1000),  // originalMintAmount
// 	  new anchor.BN(11),    // depositAmount
// 	);
// 	const hacker1 = new User(
// 	  vault1,
// 	  new anchor.BN(1000),  // originalMintAmount
// 	  new anchor.BN(7)      // depositAmount
// 	);

// 	const hacker1OwnedVault = new Vault(mint1, hacker1, u.bn(1e6));
// 	// ^ This is just an extra vault with the same mint as vault1, but with hacker1 as the owner
// 	//   hacker1.vault should NOT change to hacker1OwnedVault.

// 	// Mint 2: Used to test overflow and vault_max checks mainly.
// 	const mint2 = Mint.createNew(program, connection, mintCreator, 6);
// 	const vault2 = new Vault(mint2, vaultCreator, u.U64_MAX.sub(new anchor.BN(100000)));
// 	// ^ vault2 MUST be created by vault1.vaultCreator. Tests rely on that fact
// 	const hacker2 = new User(
// 	  vault2,
// 	  u.U64_MAX.sub(new anchor.BN(1)),  // originalMintAmount
// 	  u.U64_MAX.div(new anchor.BN(3))   // depositAmount
// 	);
// 	const citizen2 = new User(
// 	  vault2,
// 	  new anchor.BN(1),  // originalMintAmount
// 	  new anchor.BN(1)   // depositAmount
// 	  );

// 	let hacker1Vault2AccrueTokenAccount: anchor.web3.PublicKey;  // hacker1's accrue mint account for vault2

// 	const users = [
// 	  mintCreator,
// 	  vaultCreator,
// 	  citizen1,
// 	  hacker1,
// 	  hacker2,
// 	  citizen2,
// 	];

// 	const mints = [
// 	  mint1,
// 	  mint2,
// 	]

// 	const vaults = [
// 	  vault1,
// 	  hacker1OwnedVault,
// 	  vault2,
// 	]

// 	before(async () => {
// 	  // Airdrop Lamports
// 	  await u.bulkAirdrop(connection, users);

// 	  // Create Mints, Token Accounts, and Vaults
// 	  await Promise.all(mints.map(mint => mint.initialize()));
// 	  await Promise.all(users.map(user => user.initialize()));
// 	  await Promise.all(vaults.map(vault => vault.initialize()));

// 	  // Initialize Vaults (and create accrue_mints)
// 	  await Promise.all(vaults.map(v => initVault(v)));

// 	  // Create users' accrue mint token accounts
// 	  await Promise.all(
// 		users.map(user => user.initializeAccrueTokenAccount())
// 	  );

// 	  // Accrue token account for hacker1 for vault2
// 	  hacker1Vault2AccrueTokenAccount = (await vault2.accrueMint.getOrCreateAssociatedAccountInfo(
// 		hacker1.publicKey
// 	  )).address;
// 	});

//   /************************************************************

//   POOL: DEPOSIT

//   *************************************************************/

//   it('DepositPool: Failure: Constraint: depositor did not sign the txn', async () => {
// 	// No signers
// 	await chai.expect(
// 	  // NOTE: not a simulation because `simulate` doesn't check signers
// 	  instr.depositPool(citizen1, {
// 		signers: []
// 	  })
// 	).to.be.rejectedWith("Signature verification failed");

// 	// Wrong signer
// 	await chai.expect(
// 	  // NOTE: not a simulation because `simulate` doesn't check signers
// 	  instr.depositPool(citizen1, {
// 		signers: [hacker1.keypair]
// 	  })
// 	).to.be.rejectedWith(`unknown signer: ${hacker1.publicKey}`);
//   });

//   it('DepositPool: Failure: Constraint: vault_info is not owned by program', async () => {
// 	const res = await instr.depositPool(hacker1, {
// 	  vaultInfo: hacker1.mintTokenAccount,
// 	}, true);
// 	u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('DepositPool: Failure: Constraint: pool has wrong mint or vault_creator', async () => {
// 	// wrong mint
// 	const res1 = await instr.depositPool(hacker1, {
// 	  pool: vault2.pool.publicKey,  // same vault_creator but different mint
// 	}, true)
// 	u.assertSimulationError(res1, [2006]);  // ConstraintSeeds

// 	// wrong vault_creator
// 	const res2 = await instr.depositPool(hacker1, {
// 	  pool: hacker1OwnedVault.pool.publicKey   // same mint but different vault_creator
// 	}, true);
// 	u.assertSimulationError(res2, [2006]);  // ConstraintSeeds
//   });

//   it('DepositPool: Failure: Constraint: accrue_mint has wrong mint or vault_creator', async () => {
// 	// wrong mint
// 	const res1 = await instr.depositPool(hacker1, {
// 	  accrueMint: vault2.accrueMint.publicKey,  // vault2 has same vault_creator
// 	}, true);
// 	u.assertSimulationError(res1, [2006]);  // ConstraintSeeds

// 	// wrong vault_creator
// 	const res2 = await instr.depositPool(hacker1, {
// 	  accrueMint: hacker1OwnedVault.accrueMint.publicKey,  // hacker1OwnedVault has same mint as hacker1.vault
// 	}, true);
// 	u.assertSimulationError(res2, [2006]);  // ConstraintSeeds
//   });

//   it('DepositPool: Failure: Constraint: depositor_token_account is not owned by token program', async () => {
// 	const res1 = await instr.depositPool(hacker1, {
// 	  depositorTokenAccount: hacker1.publicKey,
// 	}, true);
// 	u.assertSimulationError(res1, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('DepositPool: Failure: Constraint: depositor_accrue_token_account is not owned by token program', async () => {
// 	const res1 = await instr.depositPool(hacker1, {
// 	  depositorAccrueTokenAccount: hacker1.publicKey,
// 	}, true);
// 	u.assertSimulationError(res1, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('DepositPool: Failure: Constraint: program was wrong', async () => {
// 	// Token Program
// 	const res1 = await instr.depositPool(hacker1, {
// 	  tokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID
// 	}, true)
// 	u.assertSimulationError(res1, [3008]);  // InvalidProgramId

// 	// Rent
// 	const res2 = await instr.depositPool(hacker1, {
// 	  rent: anchor.web3.SystemProgram.programId
// 	}, true)
// 	u.assertSimulationError(res2, ["InvalidArgument"]);

// 	// Clock
// 	const res3 = await instr.depositPool(hacker1, {
// 		clock: anchor.web3.BPF_LOADER_PROGRAM_ID
// 	}, true);
// 	u.assertSimulationError(res3, ["InvalidArgument"]);
//   });

//   it('DepositPool: Failure: depositor_token_account has wrong owner', async () => {
// 	const res = await instr.depositPool(hacker1, {
// 	  depositorTokenAccount: citizen1.mintTokenAccount,
// 	}, true);
// 	u.assertSimulationError(res, [accrueErrors.TokenAccountOwnershipError]);
//   });

//   it('DepositPool: Failure: depositor_token_account has wrong mint', async () => {
// 	const hacker1WrongMintAccount = await hacker1.createTokenAccount(
// 	  vault2.mint
// 	);  // do NOT mint any new supply for vault2!! because overflow

// 	const res = await instr.depositPool(hacker1, {
// 	  depositorTokenAccount: hacker1WrongMintAccount,
// 	}, true);
// 	u.assertSimulationError(res, [accrueErrors.TokenAccountMintMismatchError]);
//   });

//   it('DepositPool: Failure: depositor_accrue_token_account has the wrong owner or mint', async () => {
// 	// wrong owner
// 	const res1 = await instr.depositPool(hacker1, {
// 	  depositorAccrueTokenAccount: citizen1.accrueMintTokenAccount,
// 	}, true);
// 	u.assertSimulationError(res1, [accrueErrors.AccrueTokenAccountOwnershipError]);

// 	// wrong mint
// 	const res2 = await instr.depositPool(hacker1, {
// 	  depositorAccrueTokenAccount: hacker1Vault2AccrueTokenAccount,
// 	}, true);
// 	u.assertSimulationError(res2, [accrueErrors.AccrueTokenAccountMintMismatchError]);
//   });

//   it('DepositPool: Failure: amount == 0', async () => {
// 	const res = await instr.depositPool(hacker1, {
// 	  depositAmount: new anchor.BN(0),
// 	}, true);
// 	u.assertSimulationError(res, [accrueErrors.DepositZeroError]);
//   });

//   it('DepositPool: Failure: deposit_amount > depositor_token_account.amount', async () => {
// 	const hacker1balance = (await hacker1.vault.mint.splToken.getAccountInfo(hacker1.mintTokenAccount)).amount;
// 	const minDepositToTriggerError = hacker1balance.add(new anchor.BN(1));

// 	const pool = await hacker1.vault.mint.splToken.getAccountInfo(hacker1.vault.pool.publicKey);
// 	const poolSpaceLeft = hacker1.vault.vaultMax.sub(pool.amount);
// 	assert(minDepositToTriggerError.lt(poolSpaceLeft));  // make sure there's enough space left in the pool to make this deposit

// 	const res = await instr.depositPool(hacker1, {
// 	  depositAmount: minDepositToTriggerError,
// 	}, true);
// 	u.assertSimulationError(res, [accrueErrors.DepositInsufficientFundsError]);
//   });

//   it('DepositPool: Success: See below for test explanations', async () => {
// 	// Constants
// 	const depositors = [
// 	  citizen1,  // Pool Empty
// 	  citizen1,  // Pool Partially Filled - Recurring Depositor
// 	  hacker1,   // Pool Partially Filled - New Depositor. (hacker1 isn't doing anything malicious here)
// 	];
// 	const accrueInterestAmount = new anchor.BN(23);

// 	// Vault Pre Checks
// 	const vaultPreCheckPoolAmount = (await vault1.mint.splToken.getAccountInfo(vault1.pool.publicKey)).amount;  // total funds in vault
// 	const vaultPreCheckAccrueMintSupply = (await vault1.accrueMint.getMintInfo()).supply;  // mint supply
// 	assert(vaultPreCheckPoolAmount.isZero());  // so that we can check deposit on empty pool
// 	assert(vaultPreCheckAccrueMintSupply.isZero());
// 	assert(depositors.map(depositor => depositor.vault == vault1));  // make sure all depositors are depositing to same vault

// 	// Deposits
// 	for (let i = 0; i < depositors.length; i++) {
// 	  const depositor = depositors[i];

// 	  assert(!depositor.depositAmount.isZero());  // dont want to fail because depositAmount == 0

// 	  // Run test with accrued interest for the pool if it's the last depositor
// 	  if (i == depositors.length - 1) {
// 		await depositor.vault.accrueInterest(accrueInterestAmount.toNumber());
// 	  }

// 	  const poolBefore = (await vault1.mint.splToken.getAccountInfo(vault1.pool.publicKey)).amount;  // total funds in vault
// 	  const accrueMintSupplyBefore = (await vault1.accrueMint.getMintInfo()).supply;  // mint supply
// 	  const depositorMintBalanceBefore = (await vault1.mint.splToken.getAccountInfo(depositor.mintTokenAccount)).amount;
// 	  const depositorAccrueMintBalanceBefore = (await vault1.accrueMint.getAccountInfo(depositor.accrueMintTokenAccount)).amount;

// 	  await instr.depositPool(depositor);

// 	  const expectedAccrueSupplyMinted = u.calculateExpectedAccrueSupplyMinted(
// 		poolBefore,
// 		accrueMintSupplyBefore,
// 		depositor.depositAmount,
// 	  );

// 	  // vault_info
// 	  const vaultInfoAfter = (await program.account.vaultInfo.fetch(depositor.vault.vaultInfo));
// 	  depositor.vault.pool.balance = poolBefore.add(depositor.depositAmount);
// 	  depositor.vault.pool.lastUpdate.stale = false;
// 	  assert(vaultInfoAfter.pool.lastUpdate.slot.gt(depositor.vault.pool.lastUpdate.slot));  // slot should have changed
// 	  depositor.vault.pool.lastUpdate.slot = vaultInfoAfter.pool.lastUpdate.slot;
//       depositor.vault.balanceEstimate = depositor.vault.pool.balance;
// 	  depositor.vault.assertEqual(vaultInfoAfter);

// 	  // pool
// 	  const poolAfter = (await vault1.mint.splToken.getAccountInfo(vault1.pool.publicKey)).amount;
// 	  const expectedPoolAfterDeposit = poolBefore.add(depositor.depositAmount);
// 	  assert(poolAfter.eq(expectedPoolAfterDeposit));

// 	  // accrue_mint
// 	  const accrueMintSupplyAfter = (await vault1.accrueMint.getMintInfo()).supply;  // mint supply
// 	  const expectedAccrueMintSupply = accrueMintSupplyBefore.add(expectedAccrueSupplyMinted);
// 	  assert(accrueMintSupplyAfter.eq(expectedAccrueMintSupply));

// 	  // depositor_token_account
// 	  const depositorMintBalanceAfter = (await vault1.mint.splToken.getAccountInfo(depositor.mintTokenAccount)).amount;
// 	  const expectedDepositorBalance = depositorMintBalanceBefore.sub(depositor.depositAmount);
// 	  assert(depositorMintBalanceAfter.eq(expectedDepositorBalance));

// 	  // depositor_accrue_token_account
// 	  const depositorAccrueMintBalanceAfter = (await vault1.accrueMint.getAccountInfo(depositor.accrueMintTokenAccount)).amount;
// 	  const expectedDepositorAccrueMintBalance = depositorAccrueMintBalanceBefore.add(expectedAccrueSupplyMinted);
// 	  assert(depositorAccrueMintBalanceAfter.eq(expectedDepositorAccrueMintBalance));

// 	  if (i == depositors.length - 1) {
// 		// make sure we checked the full equation, as if interest has actually accrued.
// 		// if these are equal, then it means that interest never accrued, and only deposits happened:
// 		assert(!accrueMintSupplyAfter.eq(poolAfter));
// 	  }
// 	}
//   });

//   it('DepositPool: Success: accrue_tokens calculation does not cause overflow', async () => {
// 	// deposit causes overflow with u64
// 	assert(hacker2.depositAmount.mul(hacker2.depositAmount).gt(u.U64_MAX));

// 	// pool before is zero
// 	const poolBefore = (await hacker2.vault.mint.splToken.getAccountInfo(hacker2.vault.pool.publicKey)).amount;
// 	assert(poolBefore.isZero());

// 	await instr.depositPool(hacker2);  // initial seed deposit
// 	const res = await instr.depositPool(hacker2, {}, true);  // second massive deposit should NOT cause overflow
// 	assert(res.value.err === null);
//   });

//   it('DepositPool: Failure: vault_max exceeded (i.e. amount + pool.amount > vault_max)', async () => {
// 	const poolBefore = (await vault1.mint.splToken.getAccountInfo(vault1.pool.publicKey)).amount;
// 	const poolSpaceLeft = vault1.vaultMax.sub(poolBefore);

// 	// Create vault1 account for hacker2, mint a ton of tokens to exceed vault max, and then burn tokens to clean up
// 	const minFundsToExceedVaultMax = poolSpaceLeft.add(new anchor.BN(1));
// 	const hacker2Mint1Tokens = await hacker2.createTokenAccount(vault1.mint);
//     vault1.mint.fundTokenAccount(
//         hacker2Mint1Tokens,
//         minFundsToExceedVaultMax,
//     )
// 	const hacker2AccrueMintTokens1 = await vault1.accrueMint.createAssociatedTokenAccount(
// 	  hacker2.publicKey
// 	);

// 	const res = await instr.depositPool(hacker2, {
// 	  depositAmount: minFundsToExceedVaultMax,
// 	  vaultInfo: vault1.vaultInfo,
// 	  pool: vault1.pool.publicKey,
// 	  depositorTokenAccount: hacker2Mint1Tokens,
// 	  accrueMint: vault1.accrueMint.publicKey,
// 	  depositorAccrueTokenAccount: hacker2AccrueMintTokens1,
// 	}, true);
// 	u.assertSimulationError(res, [accrueErrors.DepositVaultMaxError]);
//   });

//   it('DepositPool: Failure: User deposit is too small; At least one accrue_mint token must be minted', async () => {
// 	const supplyBefore = (await citizen1.vault.accrueMint.getMintInfo()).supply;
// 	const poolBefore = (await citizen1.vault.mint.splToken.getAccountInfo(citizen1.vault.pool.publicKey)).amount;

// 	// make sure amount of accrue_mint minted is expected to be 0
// 	const expectedAccrueMinted = u.calculateExpectedAccrueSupplyMinted(
// 	  poolBefore,
// 	  supplyBefore,
// 	  new anchor.BN(1),
// 	)
// 	assert(expectedAccrueMinted.isZero());

// 	const res = await instr.depositPool(citizen1, {
// 	  depositAmount: new anchor.BN(1),
// 	}, true);
// 	u.assertSimulationError(res, [accrueErrors.DepositMinimumError]);
//   });

//   /************************************************************

//   POOL: WITHDRAW

//   *************************************************************/

//   it('WithdrawPool: Failure: Constraint: withdrawer did not sign the txn', async () => {
//     // No signers
//     await chai.expect(
//       // NOTE: not a simulation because `simulate` doesn't check signers
//       instr.withdrawPool(hacker1, {
//         signers: []
//       })
//     ).to.be.rejectedWith("Signature verification failed");

//     // Wrong signer
//     await chai.expect(
//       // NOTE: not a simulation because `simulate` doesn't check signers
//       instr.withdrawPool(citizen1, {
//         signers: [hacker1.keypair]
//       })
//     ).to.be.rejectedWith(`unknown signer: ${hacker1.publicKey}`);
//   });

//   it('WithdrawPool: Failure: Constraint: vault_info is not owned by program', async () => {
//     const res = await instr.withdrawPool(hacker1, {
//       vaultInfo: hacker1.mintTokenAccount,
//     }, true);
//     u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('WithdrawPool: Failure: Constraint: pool is not owned by program', async () => {
//     const res = await instr.withdrawPool(hacker1, {
//       pool: hacker1.publicKey,
//     }, true);
//     u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('WithdrawPool: Failure: Constraint: pool has wrong creator or mint', async () => {
//     // wrong mint
//     const res1 = await instr.withdrawPool(hacker1, {
//       pool: vault2.pool.publicKey,
//     }, true);
//     u.assertSimulationError(res1, [2006]);  // ConstraintSeeds

//     // wrong vault_creator
//     const res2 = await instr.withdrawPool(hacker1, {
//       pool: hacker1OwnedVault.pool.publicKey,
//     }, true);
//     u.assertSimulationError(res2, [2006]);  // ConstraintSeeds
//   });

//   it('WithdrawPool: Failure: Constraint: mint is not owned by token program', async () => {
//     const res = await instr.withdrawPool(hacker1, {
//       mint: hacker1.publicKey,
//     }, true);
//     u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('WithdrawPool: Failure: Constraint: accrue_mint has wrong mint or vault_creator', async () => {
//     // wrong mint
//     const res1 = await instr.withdrawPool(hacker1, {
//       accrueMint: vault2.accrueMint.publicKey
//     }, true);
//     u.assertSimulationError(res1, [2006]);  // ConstraintSeeds

//     // wrong vault_creator
//     const res2 = await instr.withdrawPool(hacker1, {
//       accrueMint: hacker1OwnedVault.accrueMint.publicKey
//     }, true);
//     u.assertSimulationError(res2, [2006]);  // ConstraintSeeds
//   });

//   it('WithdrawPool: Failure: Constraint: withdrawer_accrue_token_account is not owned by token program', async () => {
//     // wrong mint
//     const res = await instr.withdrawPool(hacker1, {
//       withdrawerAccrueTokenAccount: hacker1.publicKey,
//     }, true);
//     u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('WithdrawPool: Failure: Constraint: withdrawer_token_account is not owned by token program', async () => {
//     // wrong mint
//     const res = await instr.withdrawPool(hacker1, {
//       withdrawerTokenAccount: hacker1.publicKey,
//     }, true);
//     u.assertSimulationError(res, [3007]);  // AccountOwnedByWrongProgram
//   });

//   it('WithdrawPool: Failure: Constraint: program is wrong', async () => {
//     // Token Program
//     const res1 = await instr.withdrawPool(hacker1, { tokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID }, true)
//     u.assertSimulationError(res1, [3008]);  // InvalidProgramId

//     // Rent
//     const res2 = await instr.withdrawPool(hacker1, { rent: anchor.web3.SystemProgram.programId }, true)
//     u.assertSimulationError(res2, ["InvalidArgument"]);

// 	// Clock
//     const res3 = await instr.withdrawPool(hacker1, { clock: anchor.web3.BPF_LOADER_PROGRAM_ID }, true)
//     u.assertSimulationError(res3, ["InvalidArgument"]);
//   });

//   it('WithdrawPool: Failure: user_withdraws_disabled is true', async () => {
//     await changeVaultInfo(vault1, {
//         userWithdrawsDisabled: true,
//     });

// 	const res = await instr.withdrawPool(hacker1, {}, true);
// 	u.assertSimulationError(res, [accrueErrors.UserDepositWithdrawDisabledError]);

//     await changeVaultInfo(vault1);  // reset userWithdrawsDisabled
//   });

//   it('WithdrawPool: Failure: mint != vault_info.mint', async () => {
//     const res = await instr.withdrawPool(hacker1, {
//       mint: vault2.mint.splToken.publicKey
//     }, true);
//     u.assertSimulationError(res, [accrueErrors.VaultInfoMintMismatchError]);
//   });

//   it('WithdrawPool: Failure: withdrawer_accrue_token_account has wrong owner or mint', async () => {
//     // wrong owner
//     const res1 = await instr.withdrawPool(hacker1, {
//       withdrawerAccrueTokenAccount: citizen1.accrueMintTokenAccount,
//     }, true);
//     u.assertSimulationError(res1, [accrueErrors.AccrueTokenAccountOwnershipError]);

//     // wrong mint
//     const res2 = await instr.withdrawPool(hacker1, {
//       withdrawerAccrueTokenAccount: hacker1Vault2AccrueTokenAccount,
//     }, true);
//     u.assertSimulationError(res2, [accrueErrors.AccrueTokenAccountMintMismatchError]);
//   });

//   it('WithdrawPool: Failure: withdrawer_token_account has wrong owner or mint', async () => {
//     // wrong owner
//     const res1 = await instr.withdrawPool(hacker1, {
//       withdrawerTokenAccount: citizen1.mintTokenAccount,
//     }, true);
//     u.assertSimulationError(res1, [accrueErrors.TokenAccountOwnershipError]);

//     // wrong mint
//     const hacker1Vault2TokenAccount = await hacker1.createTokenAccount(vault2.mint);
//     const res2 = await instr.withdrawPool(hacker1, {
//       withdrawerTokenAccount: hacker1Vault2TokenAccount,
//     }, true);
//     u.assertSimulationError(res2, [accrueErrors.TokenAccountMintMismatchError]);
//   });

//   it('WithdrawPool: Failure: amount == 0', async () => {
//     const res = await instr.withdrawPool(citizen1, {
//       withdrawAmount: new anchor.BN(0),
//     }, true);
//     u.assertSimulationError(res, [accrueErrors.WithdrawZeroError]);
//   });

//   it('WithdrawPool: Failure: accrue_token_account.amount < withdraw amount', async () => {
//     const numTokens = (await hacker1.vault.accrueMint.getAccountInfo(hacker1.accrueMintTokenAccount)).amount;

//     const res = await instr.withdrawPool(hacker1, {
//       withdrawAmount: numTokens.add(new anchor.BN(1)),
//     }, true);
//     u.assertSimulationError(res, [accrueErrors.WithdrawInsufficientFundsError]);
//   });

//   it('WithdrawPool: Failure: overflow in calculating pool_withdraw_amount', async () => {
//     const hacker2AccrueBalance = (await vault2.accrueMint.getAccountInfo(hacker2.accrueMintTokenAccount)).amount;
// 	const supplyBefore = (await vault2.accrueMint.getMintInfo()).supply;
// 	assert(hacker2AccrueBalance.mul(supplyBefore).gt(u.U64_MAX));  // assert that it would cause overflow
//     const res = await instr.withdrawPool(hacker2, {
//       withdrawAmount: hacker2AccrueBalance,
//     }, true);
//     assert(res.value.err === null);
//   });

//   it('WithdrawPool: Failure: total_balance > 0 but aToken.supply = 0', async () => {
//     // this only happens when user deposits before the first user deposits
//     const tempVault = new Vault(mint1, citizen1, u.U64_MAX);
//     await tempVault.initialize();
//     await initVault(tempVault);
//     const tempATokenAccount = await tempVault.accrueMint.createAssociatedTokenAccount(
//         citizen1.publicKey
//     );

//     await tempVault.accrueInterest(10);
//     const res = await instr.depositPool(citizen1, {
//         vaultInfo: tempVault.vaultInfo,
//         pool: tempVault.pool.publicKey,
//         accrueMint: tempVault.accrueMint.publicKey,
//         depositorAccrueTokenAccount: tempATokenAccount,
//     }, true);
//     u.assertSimulationError(res, [accrueErrors.OverflowError]);
//   });

//   it('WithdrawPool: Success: (1) Withdraw part of the pool, (2) Withdraw entire pool', async () => {
//     const supplyBeforeWithdraws = (await vault1.accrueMint.getMintInfo()).supply;

//     const withdrawers = [citizen1, hacker1];
//     assert(withdrawers.map(withdrawer => withdrawer.vault == vault1));

//     // Assert that `withdrawers` holds all of the existing supply of accrue mint
//     let withdrawersBalanceBefore = new anchor.BN(0);
//     for (let i = 0; i < withdrawers.length; i++) {
//       const withdrawer = withdrawers[i];
//       const withdrawerBalance = (await vault1.accrueMint.getAccountInfo(withdrawer.accrueMintTokenAccount)).amount;
//       withdrawersBalanceBefore = withdrawersBalanceBefore.add(withdrawerBalance);
//     }
//     assert(withdrawersBalanceBefore.eq(supplyBeforeWithdraws));

//     for (let i = 0; i < withdrawers.length; i++) {
//       const withdrawer = withdrawers[i];
//       const accrueBalanceBeforeWithdraws = (await vault1.accrueMint.getAccountInfo(withdrawer.accrueMintTokenAccount)).amount;

//       // Run test with accrued interest for the pool if it's the last test
//       if (i == withdrawers.length - 1) {
//         const poolBeforeAccrueInterest = (await vault1.mint.splToken.getAccountInfo(vault1.pool.publicKey)).amount;
//         await vault1.accrueInterest(poolBeforeAccrueInterest.toNumber());  // multiply the pool times two
//       }

//       // Split it into two withdraws so we can test (1) user can withdraw part of their funds and
//       // (2) user can withdraw all of their funds <- but actually, 27/2 = 13. So there is usually 1 aToken left in their balance.
//       // So we're probably not actually checking if they completely cleared their funds.
//       for (let j = 0; j < 2; j++) {
//         const withdrawAmount = accrueBalanceBeforeWithdraws.div(new anchor.BN(2));

//         const poolBefore = (await vault1.mint.splToken.getAccountInfo(vault1.pool.publicKey)).amount;  // total funds in vault
//         const accrueMintSupplyBefore = (await vault1.accrueMint.getMintInfo()).supply;  // mint supply
//         const withdrawerMintBalanceBefore = (await vault1.mint.splToken.getAccountInfo(withdrawer.mintTokenAccount)).amount;
//         const withdrawerAccrueMintBalanceBefore = (await vault1.accrueMint.getAccountInfo(withdrawer.accrueMintTokenAccount)).amount;

//         await instr.withdrawPool(withdrawer, {
//           withdrawAmount: withdrawAmount,
//         });

//         // vault_info
//         const vaultInfoAfter = await program.account.vaultInfo.fetch(withdrawer.vault.vaultInfo);
//         assert(vaultInfoAfter.pool.lastUpdate.slot.gt(withdrawer.vault.pool.lastUpdate.slot));  // slot should have increased
// 		withdrawer.vault.pool.balance = (await vault1.mint.splToken.getAccountInfo(vault1.pool.publicKey)).amount;  // total funds in vault
// 		withdrawer.vault.pool.lastUpdate.stale = false;
// 		withdrawer.vault.pool.lastUpdate.slot = vaultInfoAfter.pool.lastUpdate.slot;
//         withdrawer.vault.balanceEstimate = withdrawer.vault.pool.balance;
//         withdrawer.vault.assertEqual(vaultInfoAfter);

//         const expectedPoolReturned = withdrawAmount.mul(poolBefore).div(accrueMintSupplyBefore);

//         // pool
//         const poolAfter = (await vault1.mint.splToken.getAccountInfo(vault1.pool.publicKey)).amount;  // total funds in vault
//         const expectedPoolAfterDeposit = poolBefore.sub(expectedPoolReturned);
//         assert(poolAfter.eq(expectedPoolAfterDeposit));

//         // accrue_mint
//         const accrueMintSupplyAfter = (await vault1.accrueMint.getMintInfo()).supply;  // mint supply
//         const expectedAccrueMintSupply = accrueMintSupplyBefore.sub(withdrawAmount);
//         assert(accrueMintSupplyAfter.eq(expectedAccrueMintSupply));

//         // withdrawer_accrue_token_account
//         const withdrawerAccrueMintBalanceAfter = (await vault1.accrueMint.getAccountInfo(withdrawer.accrueMintTokenAccount)).amount;
//         const expectedWithdrawerAccrueMintBalance = withdrawerAccrueMintBalanceBefore.sub(withdrawAmount);
//         assert(withdrawerAccrueMintBalanceAfter.eq(expectedWithdrawerAccrueMintBalance));

//         // withdrawer_token_account
//         const withdrawerMintBalanceAfter = (await vault1.mint.splToken.getAccountInfo(withdrawer.mintTokenAccount)).amount;
//         const expectedWithdrawerBalance = withdrawerMintBalanceBefore.add(expectedPoolReturned);
//         assert(withdrawerMintBalanceAfter.eq(expectedWithdrawerBalance));
//       }
//     }

//     const supplyAfterWithdraws = (await vault1.accrueMint.getMintInfo()).supply;
//     let withdrawersBalanceAfter = new anchor.BN(0);
//     for (let i = 0; i < withdrawers.length; i++) {
//       const withdrawer = withdrawers[i];
//       const withdrawerBalance = (await vault1.accrueMint.getAccountInfo(withdrawer.accrueMintTokenAccount)).amount;
//       withdrawersBalanceAfter = withdrawersBalanceAfter.add(withdrawerBalance);
//     }
//     assert(withdrawersBalanceAfter.eq(supplyAfterWithdraws));
//     // ^ supplyAfterWithdraws may not be 0 after all withdraws, because 27/2 is a whole number, not a decimal
//   });
// });
