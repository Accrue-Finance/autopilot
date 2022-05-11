import * as anchor from '@project-serum/anchor';
import * as spl from '@solana/spl-token';
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { bn } from "../../general/utils";
import * as _ from "lodash";
import * as u from "../../general/utils";
import { LastUpdate, Mint, Vault } from '../../vault/classes';
import { SOL_DEVNET, USDC_DEVNET } from '../../general/accounts';
import { DEST_COLLATERAL_SEED } from "../protocol";
import { Program } from '@project-serum/anchor';
import { Autopilot } from '../../../target/types/autopilot';
import { Connection } from '@solana/web3.js';

chai.use(chaiAsPromised.default);
const assert = chai.assert;
const { PublicKey } = anchor.web3;

export const SOLEND_UUID = "SLND";


export const SOLEND_ACCOUNTS = {
    programId: new PublicKey("ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx"),
    lendingMarket: new PublicKey("GvjoVKNjBvQcFaSKUW1gTE7DxhSpjHbE69umVR5nPuQp"),
    lendingMarketAuth: new PublicKey("EhJ4fwaXUp7aiwvZThSUaGWCaBQAJe3AEaJJJVCn3UCK"),
    pythOracle: new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"),
    switchboardOracle: new PublicKey("AdtRGGhmqvom3Jemp5YNrxd9q9unX36BZk1pujkkXijL"),
    mints: [
        {
            address: SOL_DEVNET,
            reserve: new PublicKey("5VVLD7BQp8y3bTgyF5ezm1ResyMTR3PhYsT4iHFU8Sxz"),
            reserveCollateralMint: new PublicKey("FzwZWRMc3GCqjSrcpVX3ueJc6UpcV6iWWb7ZMsTXE3Gf"),
            reserveLiquiditySupply: new PublicKey("furd3XUtjXZ2gRvSsoUts9A5m8cMJNqdsyR2Rt8vY9s"),
        },
        {
            address: USDC_DEVNET,
            reserve: new PublicKey("FNNkz4RCQezSSS71rW2tvqZH1LCkTzaiG7Nd1LeA5x5y"),
            reserveCollateralMint: new PublicKey("E2PSSXsXJGdpqhhaV3rYPpuy1inRCQAWxcdykA1DTmYr"),
            reserveLiquiditySupply: new PublicKey("HixjFJoeD2ggqKgFHQxrcJFjVvE5nXKuUPYNijFg7Kc5"),
    }],
}

export class SolendProtocol {
    uuid: Uint8Array = u.convertStrToUint8(SOLEND_UUID);
    depositsDisabled: boolean = false;
    distribution: anchor.BN = bn(0);
    balance: anchor.BN = bn(0);
    lastUpdate: LastUpdate = new LastUpdate();

    // general
    programId: anchor.web3.PublicKey = SOLEND_ACCOUNTS.programId;
    lendingMarket: anchor.web3.PublicKey = SOLEND_ACCOUNTS.lendingMarket;
    lendingMarketAuth: anchor.web3.PublicKey = SOLEND_ACCOUNTS.lendingMarketAuth;
    pythOracle: anchor.web3.PublicKey = SOLEND_ACCOUNTS.pythOracle;
    switchboardOracle: anchor.web3.PublicKey = SOLEND_ACCOUNTS.switchboardOracle;

    // reserve
    vault: Vault;
    reserve: anchor.web3.PublicKey;
    reserveLiquiditySupply: anchor.web3.PublicKey;
    reserveCollateralMint: Mint;

    // our ctoken account
    destinationCollateral?: anchor.web3.PublicKey;  // our ctoken account
    destinationCollateralBump?: number;

    constructor (vault: Vault, program: Program<Autopilot>, connection: Connection) {
        const mintAccounts = _.find(
            SOLEND_ACCOUNTS.mints, m => vault.mint.splToken.publicKey.equals(m.address)
        );
        if (!mintAccounts) {
            throw Error("You can only run this test in devnet")
        }
        this.vault = vault;
        this.reserve = mintAccounts.reserve;
        this.reserveLiquiditySupply = mintAccounts.reserveLiquiditySupply;
        this.reserveCollateralMint = Mint.createExisting(
            program,
            connection,
            mintAccounts.reserveCollateralMint,
        );
    }

    async initialize(program: Program<Autopilot>) {
        [this.destinationCollateral, this.destinationCollateralBump] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from(DEST_COLLATERAL_SEED, "utf-8"), 
            Buffer.from(SOLEND_UUID, "utf-8"),
            this.vault.mint.splToken.publicKey.toBuffer(),
            this.vault.vaultCreator.publicKey.toBuffer()],
            program.programId,
        );
    }

    assertEqual(protocol) {
        assert(Object.keys(protocol).length === 6 + 1);  // one extra for `protocol_extra_data`
        assert(_.isEqual(protocol.uuid, Array.from(this.uuid)));
        assert(protocol.depositsDisabled === this.depositsDisabled);
        assert(protocol.distribution.eq(this.distribution), `new distribution: ${protocol.distribution}, expected distribution: ${this.distribution}`);
        assert(protocol.balance.eq(this.balance), `new balance: ${protocol.balance}, expected balance: ${this.balance}`);
        this.lastUpdate.assertEqual(protocol.lastUpdate);
        assert(protocol.destinationCollateralBump === this.destinationCollateralBump);
    }
}