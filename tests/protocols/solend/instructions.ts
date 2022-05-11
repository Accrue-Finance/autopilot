import * as anchor from '@project-serum/anchor';
import * as spl from '@solana/spl-token';
import _ from 'lodash';
import { User, Vault } from "../../vault/classes";
import { SolendProtocol, SOLEND_UUID } from './classes';
import * as u from "../../general/utils";

const UUID = SOLEND_UUID;

type initSolendOverrides = {
  vaultCreator?: anchor.web3.PublicKey,
  vaultInfo?: anchor.web3.PublicKey,
  destinationCollateralMint?: anchor.web3.PublicKey,
  destinationCollateral?: anchor.web3.PublicKey,
  systemProgram?: anchor.web3.PublicKey,
  tokenProgram?: anchor.web3.PublicKey,
  rent?: anchor.web3.PublicKey,
  signers?: anchor.web3.Keypair[],
}

function initSolendInstr(vault: Vault, overrides: initSolendOverrides = {}) {
  const protocol = _.find(vault.protocols, p => _.isEqual(p.uuid, u.convertStrToUint8(UUID)));
  return vault.mint.program.instruction.initSolend(
    {
      accounts: {
        vaultCreator: _.get(overrides, "vaultCreator", vault.vaultCreator.publicKey),
        vaultInfo: _.get(overrides, "vaultInfo", vault.vaultInfo),
        destinationCollateralMint: _.get(overrides, "destinationCollateralMint", protocol.reserveCollateralMint.splToken.publicKey),
        destinationCollateral: _.get(overrides, "destinationCollateral", protocol.destinationCollateral),
        systemProgram: _.get(overrides, "systemProgram", anchor.web3.SystemProgram.programId),
        tokenProgram: _.get(overrides, "tokenProgram", spl.TOKEN_PROGRAM_ID),
        rent: _.get(overrides, "rent", anchor.web3.SYSVAR_RENT_PUBKEY),
      },
  })
}

async function initSolend(vault: Vault, overrides: initSolendOverrides = {}, simulate: boolean = false) {
    const txn = new anchor.web3.Transaction();
    txn.add(initSolendInstr(vault, overrides));

    const signers = _.get(overrides, "signers", [vault.vaultCreator.keypair])
    if (simulate) {
      return await vault.mint.program.provider.simulate(txn, signers);
    } else {
      const res = await vault.mint.program.provider.send(txn, signers);
      return res;
    }
}

type getBalanceSolendOverrides = {
  vaultInfo?: anchor.web3.PublicKey,
  destinationCollateral?: anchor.web3.PublicKey,
  reserve?: anchor.web3.PublicKey,
  pythOracle?: anchor.web3.PublicKey,
  switchboardOracle?: anchor.web3.PublicKey,
  protocolProgram?: anchor.web3.PublicKey,
  tokenProgram?: anchor.web3.PublicKey,
  clock?: anchor.web3.PublicKey,
  signers?: anchor.web3.Keypair[],
}

function getBalanceSolendInstr(vault: Vault, overrides: getBalanceSolendOverrides = {}) {
  const protocol = _.find(vault.protocols, p => _.isEqual(p.uuid, u.convertStrToUint8(UUID)));
  return vault.mint.program.instruction.getBalanceSolend(
    {
      accounts: {
        vaultInfo: _.get(overrides, "vaultInfo", vault.vaultInfo),
        destinationCollateral: _.get(overrides, "destinationCollateral", protocol.destinationCollateral),
        reserve: _.get(overrides, "reserve", protocol.reserve),
        pythOracle: _.get(overrides, "pythOracle", protocol.pythOracle),
        switchboardOracle: _.get(overrides, "switchboardOracle", protocol.switchboardOracle),
        protocolProgram: _.get(overrides, "protocolProgram", protocol.programId),
        tokenProgram: _.get(overrides, "tokenProgram", spl.TOKEN_PROGRAM_ID),
        clock: _.get(overrides, "clock", anchor.web3.SYSVAR_CLOCK_PUBKEY),
      },
  });
}

async function getBalanceSolend(vault: Vault, overrides: getBalanceSolendOverrides = {}, simulate: boolean = false) {
    const txn = new anchor.web3.Transaction();
    txn.add(getBalanceSolendInstr(vault, overrides));
    if (simulate) {
      return await vault.mint.program.provider.simulate(txn, []);
    } else {
      const res = await vault.mint.program.provider.send(txn, []);
      return res;
    }
}

type rebalanceSolendOverrides = {
  vaultCreator?: anchor.web3.PublicKey,
  vaultInfo?: anchor.web3.PublicKey,
  pool?: anchor.web3.PublicKey,
  destinationCollateral?: anchor.web3.PublicKey,
  reserve?: anchor.web3.PublicKey,
  reserveLiquiditySupply?: anchor.web3.PublicKey,
  reserveCollateralMint?: anchor.web3.PublicKey,
  lendingMarket?: anchor.web3.PublicKey,
  lendingMarketAuth?: anchor.web3.PublicKey,
  protocolProgram?: anchor.web3.PublicKey,
  tokenProgram?: anchor.web3.PublicKey,
  clock?: anchor.web3.PublicKey,
  signers?: anchor.web3.Keypair[],
}

function rebalanceSolendInstr(vault: Vault, overrides: rebalanceSolendOverrides = {}) {
  const protocol = _.find(vault.protocols, p => _.isEqual(p.uuid, u.convertStrToUint8(UUID)));
  return vault.mint.program.instruction.rebalanceSolend(
    {
      accounts: {
        vaultCreator: _.get(overrides, "vaultCreator", vault.vaultCreator.publicKey),
        vaultInfo: _.get(overrides, "vaultInfo", vault.vaultInfo),
        pool: _.get(overrides, "pool", vault.pool.publicKey),
        destinationCollateral: _.get(overrides, "destinationCollateral", protocol.destinationCollateral),
        reserve: _.get(overrides, "reserve", protocol.reserve),
        reserveLiquiditySupply: _.get(overrides, "reserveLiquiditySupply", protocol.reserveLiquiditySupply),
        reserveCollateralMint: _.get(overrides, "reserveCollateralMint", protocol.reserveCollateralMint.splToken.publicKey),
        lendingMarket: _.get(overrides, "lendingMarket", protocol.lendingMarket),
        lendingMarketAuth: _.get(overrides, "lendingMarketAuth", protocol.lendingMarketAuth),
        protocolProgram: _.get(overrides, "protocolProgram", protocol.programId),
        tokenProgram: _.get(overrides, "tokenProgram", spl.TOKEN_PROGRAM_ID),
        clock: _.get(overrides, "clock", anchor.web3.SYSVAR_CLOCK_PUBKEY),
      },
  })
}

async function rebalanceSolend(vault: Vault, overrides: rebalanceSolendOverrides = {}, simulate: boolean = false) {
    const txn = new anchor.web3.Transaction();
    txn.add(rebalanceSolendInstr(vault, overrides));
    const signers = _.get(overrides, "signers", [vault.vaultCreator.keypair])
    if (simulate) {
      return await vault.mint.program.provider.simulate(txn, signers);
    } else {
      const res = await vault.mint.program.provider.send(txn, signers);
      return res;
    }
}

type deleteSolendOverrides = {
  vaultCreator?: anchor.web3.PublicKey,
  vaultInfo?: anchor.web3.PublicKey,
  destinationCollateral?: anchor.web3.PublicKey,
  clock?: anchor.web3.PublicKey,
  signers?: anchor.web3.Keypair[],
}

function deleteSolendInstr(vault: Vault, overrides: rebalanceSolendOverrides = {}) {
  const protocol = _.find(vault.protocols, p => _.isEqual(p.uuid, u.convertStrToUint8(UUID)));
  return vault.mint.program.instruction.deleteSolend(
    {
      accounts: {
        vaultCreator: _.get(overrides, "vaultCreator", vault.vaultCreator.publicKey),
        vaultInfo: _.get(overrides, "vaultInfo", vault.vaultInfo),
        destinationCollateral: _.get(overrides, "destinationCollateral", protocol.destinationCollateral),
        clock: _.get(overrides, "clock", anchor.web3.SYSVAR_CLOCK_PUBKEY),
      },
  })
}

async function deleteSolend(vault: Vault, overrides: deleteSolendOverrides = {}, simulate: boolean = false) {
    const txn = new anchor.web3.Transaction();
    txn.add(deleteSolendInstr(vault, overrides));

    const signers = _.get(overrides, "signers", [vault.vaultCreator.keypair])
    if (simulate) {
      return await vault.mint.program.provider.simulate(txn, signers);
    } else {
      const res = await vault.mint.program.provider.send(txn, signers);
      return res;
    }
}

type withdrawSolendOverrides = {
  withdrawAmount?: anchor.BN,
  withdrawer?: anchor.web3.PublicKey,
  vaultInfo?: anchor.web3.PublicKey,
  pool?: anchor.web3.PublicKey,
  mint?: anchor.web3.PublicKey,
  accrueMint?: anchor.web3.PublicKey,
  withdrawerAccrueTokenAccount?: anchor.web3.PublicKey,
  withdrawerTokenAccount?: anchor.web3.PublicKey,
  destinationCollateral?: anchor.web3.PublicKey,
  reserve?: anchor.web3.PublicKey,
  reserveLiquiditySupply?: anchor.web3.PublicKey,
  reserveCollateralMint?: anchor.web3.PublicKey,
  lendingMarket?: anchor.web3.PublicKey,
  lendingMarketAuth?: anchor.web3.PublicKey,
  protocolProgram?: anchor.web3.PublicKey,
  tokenProgram?: anchor.web3.PublicKey,
  clock?: anchor.web3.PublicKey,
  signers?: anchor.web3.Keypair[],
}

function withdrawSolendInstr(withdrawer: User, overrides: withdrawSolendOverrides = {}) {
  const protocol = _.find(withdrawer.vault.protocols, p => _.isEqual(p.uuid, u.convertStrToUint8(UUID)));
  return withdrawer.vault.mint.program.instruction.withdrawSolend(
    _.get(overrides, "withdrawAmount", new anchor.BN(10)),
    {
      accounts: {
        withdrawer: _.get(overrides, "withdrawer", withdrawer.publicKey),
        vaultInfo: _.get(overrides, "vaultInfo", withdrawer.vault.vaultInfo),
        pool: _.get(overrides, "pool", withdrawer.vault.pool.publicKey),
        mint: _.get(overrides, "mint", withdrawer.vault.mint.splToken.publicKey),
        accrueMint: _.get(overrides, "accrueMint", withdrawer.vault.accrueMint.publicKey), 
        withdrawerAccrueTokenAccount: _.get(overrides, "withdrawerAccrueTokenAccount", withdrawer.accrueMintTokenAccount),
        withdrawerTokenAccount: _.get(overrides, "withdrawerTokenAccount", withdrawer.mintTokenAccount),
        destinationCollateral: _.get(overrides, "destinationCollateral", protocol.destinationCollateral),
        reserve: _.get(overrides, "reserve", protocol.reserve),
        reserveLiquiditySupply: _.get(overrides, "reserveLiquiditySupply", protocol.reserveLiquiditySupply),
        reserveCollateralMint: _.get(overrides, "reserveCollateralMint", protocol.reserveCollateralMint.splToken.publicKey),
        lendingMarket: _.get(overrides, "lendingMarket", protocol.lendingMarket),
        lendingMarketAuth: _.get(overrides, "lendingMarketAuth", protocol.lendingMarketAuth),
        protocolProgram: _.get(overrides, "protocolProgram", protocol.programId),
        tokenProgram: _.get(overrides, "tokenProgram", spl.TOKEN_PROGRAM_ID),
        clock: _.get(overrides, "clock", anchor.web3.SYSVAR_CLOCK_PUBKEY),
      },
  });
}

async function withdrawSolend(withdrawer: User, overrides: withdrawSolendOverrides = {}, simulate: boolean = false) {
  const txn = new anchor.web3.Transaction();
  txn.add(withdrawSolendInstr(withdrawer, overrides));

  const signers = _.get(overrides, "signers", [withdrawer.keypair])
  if (simulate) {
    return await withdrawer.vault.mint.program.provider.simulate(txn, signers);
  } else {
    const res = await withdrawer.vault.mint.program.provider.send(txn, signers);
    return res;
  }
}

function killSolendInstr(vault: Vault, overrides: rebalanceSolendOverrides = {}) {
  const protocol = _.find(vault.protocols, p => _.isEqual(p.uuid, u.convertStrToUint8(UUID)));
  return vault.mint.program.instruction.killSolend(
    {
      accounts: {
        vaultCreator: _.get(overrides, "vaultCreator", vault.vaultCreator.publicKey),
        vaultInfo: _.get(overrides, "vaultInfo", vault.vaultInfo),
        pool: _.get(overrides, "pool", vault.pool.publicKey),
        destinationCollateral: _.get(overrides, "destinationCollateral", protocol.destinationCollateral),
        reserve: _.get(overrides, "reserve", protocol.reserve),
        reserveLiquiditySupply: _.get(overrides, "reserveLiquiditySupply", protocol.reserveLiquiditySupply),
        reserveCollateralMint: _.get(overrides, "reserveCollateralMint", protocol.reserveCollateralMint.splToken.publicKey),
        lendingMarket: _.get(overrides, "lendingMarket", protocol.lendingMarket),
        lendingMarketAuth: _.get(overrides, "lendingMarketAuth", protocol.lendingMarketAuth),
        protocolProgram: _.get(overrides, "protocolProgram", protocol.programId),
        tokenProgram: _.get(overrides, "tokenProgram", spl.TOKEN_PROGRAM_ID),
        clock: _.get(overrides, "clock", anchor.web3.SYSVAR_CLOCK_PUBKEY),
      },
  })
}

async function killSolend(vault: Vault, overrides: rebalanceSolendOverrides = {}, simulate: boolean = false) {
    const txn = new anchor.web3.Transaction();
    txn.add(killSolendInstr(vault, overrides));
    const signers = _.get(overrides, "signers", [vault.vaultCreator.keypair])
    if (simulate) {
      return await vault.mint.program.provider.simulate(txn, signers);
    } else {
      const res = await vault.mint.program.provider.send(txn, signers);
      return res;
    }
}

export {
  initSolendInstr,
  initSolend,
  getBalanceSolendInstr,
  getBalanceSolend,
  rebalanceSolendInstr,
  rebalanceSolend,
  deleteSolendInstr,
  deleteSolend,
  withdrawSolendInstr,
  withdrawSolend,
  killSolendInstr,
  killSolend,
};