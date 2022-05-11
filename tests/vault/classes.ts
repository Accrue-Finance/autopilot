import * as anchor from '@project-serum/anchor';
import * as spl from '@solana/spl-token';
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { bn, god, transferLamportsToWSOL } from "../general/utils";
import * as _ from "lodash";
import * as u from "../general/utils";
import { Pool } from '../pool/classes';
import { SolendProtocol } from '../protocols/solend/classes';
import { SOL_DEVNET } from '../general/accounts';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import { Autopilot } from '../../target/types/autopilot';

chai.use(chaiAsPromised.default);
const assert = chai.assert;

const SOURCE_NEW = "new";
const SOURCE_EXISTING = "existing";

export class Mint {
    program: Program<Autopilot>;
    connection: Connection;

    // new mint
    authority?: User;
    decimals?: number;

    // existing mint
    existingTokenAccSrc?: anchor.web3.PublicKey;
    existingTokenAccSrcAuth?: anchor.web3.Keypair;
    
    source?: String;
    splToken?: spl.Token;


    // create a new mint object from an entirely new mint
    static createNew(program: Program<Autopilot>, connection: Connection, authority: User, decimals: number) {
        const mint = new Mint();
        mint.program = program;
        mint.connection = connection;
        mint.authority = authority;
        mint.decimals = decimals;
        mint.source = SOURCE_NEW;
        return mint;
    }

    // create a new mint object from an existing mint
    static createExisting(
        program: Program<Autopilot>,
        connection: Connection,
        key: anchor.web3.PublicKey, 
        existingTokenAccSrc?: anchor.web3.PublicKey,  // used to fund the account
        existingTokenAccSrcAuth?: anchor.web3.Keypair, // cant fund account if devnet AND not wSOL
    ) {
        const mint = new Mint();
        mint.program = program;
        mint.connection = connection;
        mint.splToken = new spl.Token(
            connection,
            key,
            spl.TOKEN_PROGRAM_ID,
            god.keypair,
        );
        mint.source = SOURCE_EXISTING;
        mint.existingTokenAccSrc = existingTokenAccSrc;
        mint.existingTokenAccSrcAuth = existingTokenAccSrcAuth;
        return mint;
    }

    async initialize() {
        if (this.source === SOURCE_NEW) {  // new mint
            this.splToken = await spl.Token.createMint(
                this.connection,
                this.authority.keypair,
                this.authority.publicKey,
                this.authority.publicKey,
                this.decimals,
                spl.TOKEN_PROGRAM_ID,
            );
            return this.splToken;
        } else if (this.source === SOURCE_EXISTING) {  // existing mint
            this.decimals = (await this.splToken.getMintInfo()).decimals;
        } else {
            throw Error("Mint must be created from createNew or createExisting functions");
        }
    }

    
    async fundTokenAccount(tokenAccount: anchor.web3.PublicKey, amount: anchor.BN) {
        if (this.source === SOURCE_NEW) {  // fund from a mint that we created
            await this.splToken.mintTo(
                tokenAccount, 
                this.authority.keypair, 
                [], 
                new spl.u64(amount.toString()),  // must use spl.u64 with mintTo
            );
            const minted = (await this.splToken.getAccountInfo(
                tokenAccount
            )).amount;
            assert(
                minted.eq(amount),
                `createTokenAccount: minted ${minted.toString()} tokens instead of ${amount.toString()}` 
            );  // This assertion sometimes fails, so it is necessary

        } else {  // fund from another user. Used for mints that we did not create
            // if the mint is wSOL, just convert SOL into wSOL
            if (this.splToken.publicKey === SOL_DEVNET) {
                await transferLamportsToWSOL(
                    this.connection,
                    this.existingTokenAccSrcAuth,
                    tokenAccount,
                    amount.toNumber(),
                );
            } else {
                await this.splToken.transfer(
                    this.existingTokenAccSrc, 
                    tokenAccount, 
                    this.existingTokenAccSrcAuth, 
                    [this.existingTokenAccSrcAuth], 
                    amount
                );
            }
        }
    }
}

export class User {
    vault?: Vault;
    originalMintAmount?: anchor.BN;
    depositAmount?: anchor.BN;

    keypair: anchor.web3.Keypair;
    publicKey: anchor.web3.PublicKey;
    mintTokenAccount?: anchor.web3.PublicKey;
    accrueMintTokenAccount?: anchor.web3.PublicKey;

    constructor(
        vault?: Vault,
        originalMintAmount?: anchor.BN,
        depositAmount?: anchor.BN,
    ) {
        this.vault = vault;
        this.originalMintAmount = originalMintAmount || bn(0);
        this.depositAmount = depositAmount;
        if (depositAmount) {
            assert(
                originalMintAmount.gte(depositAmount), 
                "originalMintAmount must be >= depositAmount"
            );
        }

        this.keypair = anchor.web3.Keypair.generate();
        this.publicKey = this.keypair.publicKey;
    }

    async initialize() {
        // create token account (if vault)
        if (this.vault) {
            this.mintTokenAccount = await this.createTokenAccount(
                this.vault.mint, 
            );
        }
        // fund token account (if needed)
        if (!this.originalMintAmount.isZero()) {
            this.vault.mint.fundTokenAccount(
                this.mintTokenAccount,
                this.originalMintAmount,
            );
        }
    }

    async initializeAccrueTokenAccount() { // can only be called after accrueMint is created
        if (this.vault) {
            this.accrueMintTokenAccount = await this.vault.accrueMint.createAssociatedTokenAccount(
                this.publicKey
            );
        }
    }

    async createTokenAccount(mint: Mint) {
        const tokenAccount = await mint.splToken.createAccount(
            this.publicKey
        );
        return tokenAccount;
    }
}

export class Vault {
    version: number = 56;  // why not 0? Because we need to test a non-zero value to make sure our instruction actually uses our passed in value
    cluster: number = 0; 
    mint: Mint;
    vaultCreator: User;
    client: PublicKey = SystemProgram.programId;  // 111... represents that anyone can deposit
    protocolsMax: number = 4;  // why not 0? same as `version` reason. But also we want to add protocols later
    vaultMax: anchor.BN;

    vaultInfo?: anchor.web3.PublicKey;
    vaultInfoBump?: number;
    accrueMint?: spl.Token;
    accrueMintBump?: number;
    
    // Pool
    pool?: Pool;

    // Fees
    depositFee: anchor.BN = u.bn(0);
    withdrawFee: anchor.BN = u.bn(0);
    interestFee: anchor.BN = u.bn(0);
    balanceEstimate: anchor.BN = u.bn(0);
    collectibleFee: anchor.BN = u.bn(0);

    // Protocols
    protocols: SolendProtocol[] = [];

    userWithdrawsDisabled: boolean = false;

    constructor(
        mint: Mint,
        vaultCreator: User,
        vaultMax: anchor.BN,
    ) {
        this.mint = mint;
        this.vaultCreator = vaultCreator;
        this.vaultMax = vaultMax;
        this.pool = new Pool(this);
    }

    async initialize() {
        [this.vaultInfo, this.vaultInfoBump] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("vault_info", "utf-8"), 
            this.mint.splToken.publicKey.toBuffer(), 
            this.vaultCreator.publicKey.toBuffer()],
            this.mint.program.programId
        );

        const [accrueMint, accrueMintBump] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("accrue_mint", "utf-8"), 
            this.mint.splToken.publicKey.toBuffer(), 
            this.vaultCreator.publicKey.toBuffer()],
            this.mint.program.programId
        );
        this.accrueMint = new spl.Token(
            this.mint.connection,
            accrueMint,
            spl.TOKEN_PROGRAM_ID,
            this.vaultCreator.keypair,
        );
        this.accrueMintBump = accrueMintBump;

        await this.pool.initialize(this.mint.program, this.mint.splToken.publicKey, this.vaultCreator.publicKey);
        // this doesn't do anything, bc no protocols are added yet:
        for (let i = 0; i < this.protocols.length; i++) {
            await this.protocols[i].initialize(this.mint.program);
        }
    }

    assertEqual(vault) {
        assert(Object.keys(vault).length === 14 + 1, `actual num fields on vault: ${Object.keys(vault).length}`);  // one extra for `vaultExtraSpace`
        assert(vault.version === this.version);
        assert(vault.cluster === this.cluster)
        assert(vault.vaultCreator.equals(this.vaultCreator.publicKey));
        assert(vault.client.equals(this.client));
        assert(vault.protocolsMax === this.protocolsMax);
        assert(vault.vaultMax.eq(this.vaultMax));
        assert(vault.mint.equals(this.mint.splToken.publicKey));
        assert(vault.accrueMint.equals(this.accrueMint.publicKey));
        assert(vault.accrueMintBump === this.accrueMintBump);
        assert(vault.vaultInfoBump === this.vaultInfoBump);
        assert(vault.userWithdrawsDisabled === this.userWithdrawsDisabled);

        // pool
        this.pool.assertEqual(vault.pool);

        // fees 
        assert(Object.keys(vault.fees).length === 5 + 1);  // one extra for `vaultExtraSpace`
        assert(vault.fees.depositFee.eq(this.depositFee));
        assert(vault.fees.withdrawFee.eq(this.withdrawFee));
        assert(vault.fees.interestFee.eq(this.interestFee));
        assert(vault.fees.balanceEstimate.eq(this.balanceEstimate), `expected ${this.balanceEstimate}, actual ${vault.fees.balanceEstimate}`);
        assert(vault.fees.collectibleFee.eq(this.collectibleFee), `expected ${this.collectibleFee}, actual ${vault.fees.collectibleFee}`);

        // protocols
        assert(vault.protocols.length === this.protocols.length);
        for (let i = 0; i < this.protocols.length; i++) {  
            const thisProtocol = this.protocols[i];
            const newVaultInfoProtocol = _.find(vault.protocols, p => _.isEqual(p.uuid, Array.from(thisProtocol.uuid)));
            thisProtocol.assertEqual(newVaultInfoProtocol);
        }
    }
    
    // Add funds to the wallet without generating supply, which mimics
    // the concept of accruing interest
    async accrueInterest(amountToAccrue: number) {
        return await this.mint.splToken.mintTo(
            this.pool.publicKey,
            this.mint.authority.publicKey,
            [],
            new spl.u64(amountToAccrue),  // must use spl.u64 with mintTo
        )
    }

    getProtocol (uuid: String) {
        return _.find(this.protocols, p => _.isEqual(p.uuid, u.convertStrToUint8(uuid)));
    }
}


export class LastUpdate {
    slot: anchor.BN = bn(0);
    stale: boolean = true;

    assertEqual(lastUpdate) {
        assert(lastUpdate.stale === this.stale, `${lastUpdate.stale}, ${this.stale}`);
        assert(this.slot.eq(lastUpdate.slot), `${lastUpdate.slot}, ${this.slot}`);
    }
}