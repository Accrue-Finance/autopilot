import * as anchor from '@project-serum/anchor';
import * as spl from '@solana/spl-token';
import _ from 'lodash';
import { User, Vault } from "./classes";
import * as u from "../general/utils";
import { POOL_UUID } from '../pool/classes';

type initVaultOverrides = {
  protocolsMax?: number,
  vaultMax?: anchor.BN,
  cluster?: number,
  vaultCreator?: anchor.web3.PublicKey,
  mint?: anchor.web3.PublicKey,
  pool?: anchor.web3.PublicKey,
  accrueMint?: anchor.web3.PublicKey,
  client?: anchor.web3.PublicKey,
  vaultInfo?: anchor.web3.PublicKey,
  systemProgram?: anchor.web3.PublicKey,
  tokenProgram?: anchor.web3.PublicKey,
  rent?: anchor.web3.PublicKey,
  signers?: anchor.web3.Keypair[],
}

async function initVault(vault: Vault, overrides: initVaultOverrides = {}, simulate: boolean = false) {
    const txn = new anchor.web3.Transaction();
    txn.add(
      vault.mint.program.instruction.initVault(
        _.get(overrides, "client", vault.client),
        vault.vaultMax,
        _.get(overrides, "depositFee", vault.depositFee),
        _.get(overrides, "withdrawFee", vault.withdrawFee),
        _.get(overrides, "interestFee", vault.interestFee),
        _.get(overrides, "protocolsMax", vault.protocolsMax),
        _.get(overrides, "cluster", vault.cluster),
        vault.version,
        {
          accounts: {
            vaultCreator: _.get(overrides, "vaultCreator", vault.vaultCreator.publicKey),
            mint: _.get(overrides, "mint", vault.mint.splToken.publicKey),
            pool: _.get(overrides, "pool", vault.pool.publicKey),
            accrueMint: _.get(overrides, "accrueMint", vault.accrueMint.publicKey),
            vaultInfo:_.get(overrides, "vaultInfo", vault.vaultInfo),
            systemProgram: _.get(overrides, "systemProgram", anchor.web3.SystemProgram.programId),
            tokenProgram: _.get(overrides, "tokenProgram", spl.TOKEN_PROGRAM_ID),
            rent: _.get(overrides, "rent", anchor.web3.SYSVAR_RENT_PUBKEY),
          },
      })
    )

    const signers = _.get(overrides, "signers", [vault.vaultCreator.keypair])
    if (simulate) {
      return await vault.mint.program.provider.simulate(txn, signers);
    } else {
      const res = await vault.mint.program.provider.send(txn, signers);
      return res;
    }
}

type changeVaultInfoOverrides = {
  newVaultMax?: anchor.BN,
  depositFee?: anchor.BN,
  withdrawFee?: anchor.BN,
  interestFee?: anchor.BN,
  newProtocolsMax?: anchor.BN,
  newVersion?: number,
  userWithdrawsDisabled?: boolean,
  vaultCreator?: anchor.web3.PublicKey,
  vaultInfo?: anchor.web3.PublicKey,
  signers?: anchor.web3.Keypair[],
}

function changeVaultInfoInstr(vault: Vault, overrides: changeVaultInfoOverrides = {}) {
  return vault.mint.program.instruction.changeVaultInfo(
    _.get(overrides, "newVaultMax", vault.vaultMax),
    _.get(overrides, "depositFee", vault.depositFee),
    _.get(overrides, "withdrawFee", vault.withdrawFee),
    _.get(overrides, "interestFee", vault.interestFee),
    _.get(overrides, "newProtocolsMax", vault.protocolsMax),
    _.get(overrides, "newVersion", vault.version),
    _.get(overrides, "userWithdrawsDisabled", vault.userWithdrawsDisabled) === true ? 1 : 0,
    {
      accounts: {
        vaultCreator: _.get(overrides, "vaultCreator", vault.vaultCreator.publicKey),
        vaultInfo:_.get(overrides, "vaultInfo", vault.vaultInfo),
      },
  })
}

async function changeVaultInfo(vault: Vault, overrides: changeVaultInfoOverrides = {}, simulate: boolean = false) {
  const txn = new anchor.web3.Transaction();
  txn.add(changeVaultInfoInstr(vault, overrides));

  const signers = _.get(overrides, "signers", [vault.vaultCreator.keypair])
  if (simulate) {
    return await vault.mint.program.provider.simulate(txn, signers);
  } else {
    const res = await vault.mint.program.provider.send(txn, signers);
    return res;
  }
}

type setDistributionOverrides = {
  locations?: Uint8Array[],
  distribution?: anchor.BN[],
  depositsDisabled?: boolean[],
  vaultCreator?: anchor.web3.PublicKey,
  vaultInfo?: anchor.web3.PublicKey,
  signers?: anchor.web3.Keypair[],
}

function setDistributionInstr(vault: Vault, overrides: setDistributionOverrides = {}) {
  const locations = _.flatten([
    u.convertStrToUint8(POOL_UUID),
    vault.protocols.map(p => p.uuid)
  ]);
  const distribution = _.flatten([
    vault.pool.distribution,
    vault.protocols.map(p => p.distribution)
  ]);
  const depositsDisabled = _.flatten([
    false,
    vault.protocols.map(p => p.depositsDisabled)
  ])
  return vault.mint.program.instruction.setDistribution(
    _.get(overrides, "locations", locations),
    _.get(overrides, "distribution", distribution),
    _.get(overrides, "depositsDisabled", depositsDisabled),
    {
      accounts: {
        vaultCreator: _.get(overrides, "vaultCreator", vault.vaultCreator.publicKey),
        vaultInfo:_.get(overrides, "vaultInfo", vault.vaultInfo),
      },
  });
}

// you can set vault's distributions BEFORE calling this function, 
// and make sure to call vault.assertEqual after to make sure the results were as expected!
async function setDistribution(
  vault: Vault, 
  overrides: setDistributionOverrides = {}, 
  simulate: boolean = false
) {
  const txn = new anchor.web3.Transaction();
  txn.add(setDistributionInstr(vault, overrides));

  const signers = _.get(overrides, "signers", [vault.vaultCreator.keypair])
  if (simulate) {
    return await vault.mint.program.provider.simulate(txn, signers);
  } else {
    const res = await vault.mint.program.provider.send(txn, signers);
    return res;
  }
}

type collectFeesOverrides = {
  vaultCreator?: anchor.web3.PublicKey,
  vaultInfo?: anchor.web3.PublicKey,
  pool?: anchor.web3.PublicKey,
  feeCollectionAccount?: anchor.web3.PublicKey,
  tokenProgram?: anchor.web3.PublicKey,
  clock?: anchor.web3.PublicKey,
  signers?: anchor.web3.Keypair[],
}

function collectFeesInstr(vaultCreator: User, overrides: collectFeesOverrides = {}) {
  return vaultCreator.vault.mint.program.instruction.collectFees(
    {
      accounts: {
        vaultCreator: _.get(overrides, "vaultCreator", vaultCreator.publicKey),
        vaultInfo:_.get(overrides, "vaultInfo", vaultCreator.vault.vaultInfo),
        pool: _.get(overrides, "pool", vaultCreator.vault.pool.publicKey),
        feeCollectionAccount: _.get(overrides, "feeCollectionAccount", vaultCreator.mintTokenAccount),
        tokenProgram: _.get(overrides, "tokenProgram", spl.TOKEN_PROGRAM_ID),
        clock: _.get(overrides, "clock", anchor.web3.SYSVAR_CLOCK_PUBKEY),
      },
  })
}

async function collectFees(vaultCreator: User, overrides: collectFeesOverrides = {}, simulate: boolean = false) {
  const txn = new anchor.web3.Transaction();
  txn.add(collectFeesInstr(vaultCreator, overrides));

  const signers = _.get(overrides, "signers", [vaultCreator.keypair])
  if (simulate) {
    return await vaultCreator.vault.mint.program.provider.simulate(txn, signers);
  } else {
    const res = await vaultCreator.vault.mint.program.provider.send(txn, signers);
    return res;
  }
}


export { 
  initVault, 
  changeVaultInfoInstr,
  changeVaultInfo,
  setDistributionInstr,
  setDistribution,
  collectFeesInstr,
  collectFees,
};
