import * as anchor from '@project-serum/anchor';
import * as spl from '@solana/spl-token';
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { NonceAccount, PublicKey } from '@solana/web3.js';
import { bn, U64_MAX, convertStrToUint8 } from "../general/utils";
import { LastUpdate, Mint, User, Vault } from "../vault/classes";
import * as _ from "lodash";
import { Program } from '@project-serum/anchor';
import { Autopilot } from '../../target/types/autopilot';

chai.use(chaiAsPromised.default);
const assert = chai.assert;

export const POOL_UUID = "POOL";

export class Pool {
    uuid: Uint8Array = convertStrToUint8(POOL_UUID);
    vault: Vault;
    publicKey?: anchor.web3.PublicKey;
    bump?: number;
    distribution: anchor.BN = U64_MAX;
    balance: anchor.BN = bn(0);
    lastUpdate = new LastUpdate();

    constructor (vault: Vault) {
        this.vault = vault;
    }

    async initialize(program: Program<Autopilot>, mint: PublicKey, vaultCreator: PublicKey) {
        [this.publicKey, this.bump] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("pool", "utf-8"), 
            mint.toBuffer(), 
            vaultCreator.toBuffer()],
            program.programId
        );
    }

    // "Accrues interest" by transferring user tokens into pool without minting aTokens
    async accrueInterestXfer(mint: Mint, citizen: User, amount: number) {
        return await mint.splToken.transfer(
            citizen.mintTokenAccount,
            this.publicKey,
            citizen.publicKey,
            [citizen.keypair],
            amount,
        );
    }

    assertEqual(pool) {
        assert(Object.keys(pool).length === 5 + 1);  // one extra for `pool_extra_data`
        assert(_.isEqual(pool.uuid, Array.from(this.uuid)));
        assert(pool.bump === this.bump);
        assert(pool.distribution.eq(this.distribution), `new distribution: ${pool.distribution}, expected distribution: ${this.distribution}`);
        assert(pool.balance.eq(this.balance), `new balance: ${pool.balance}, expected balance: ${this.balance}`);
        this.lastUpdate.assertEqual(pool.lastUpdate);
    }
}
