import * as anchor from '@project-serum/anchor';
import * as spl from '@solana/spl-token';
import * as chai from "chai";
import { LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction, Connection } from "@solana/web3.js";
import * as chaiAsPromised from "chai-as-promised";
import { User } from "../vault/classes";
import { TransactionInstruction } from '@solana/web3.js';
const { assert, expect } = chai;
chai.use(chaiAsPromised.default);



function assertSimulationError(res, expectedErrors, numInstruction = 0) {
    const _expectedErrors = [];
    for (let i = 0; i < expectedErrors.length; i++) {
        if (typeof expectedErrors[i] === "number") {
            _expectedErrors.push({ 
                InstructionError: [ 
                    numInstruction, 
                    { Custom: expectedErrors[i] }
                ] 
            });
            _expectedErrors.push({ "Custom": expectedErrors[i] });  // for when u use provider.simulate()
        } else if (typeof expectedErrors[i] === "string") {
            _expectedErrors.push({ 
                InstructionError: [ 
                    numInstruction, 
                    expectedErrors[i],
                ] 
            })
            _expectedErrors.push(expectedErrors[i]);  // for when u use provider.simulate()
        } else {
            throw Error(`assertSimulationError: ${expectedErrors || "<empty>"} is wrong type!`)
        }
    }
    expect(_expectedErrors).to.deep.include(res.value.err, `${JSON.stringify(res.value.err)}   !=   ${JSON.stringify(_expectedErrors)}`);
}

// Numbers
const U64_MAX = bn("18446744073709551615");  // verified that this is the max value of u64 in our smart contract

function bn(z: number | string): anchor.BN {
    return new anchor.BN(z);
}

// Strings
function convertStrToUint8(str: String): Uint8Array {
    return Uint8Array.from(str, x => x.charCodeAt(0));
    // To convert to program format: Array.from(convertStrToUint8(str))
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Airdrops
const MAX_DEVNET_AIRDROP = 2 * LAMPORTS_PER_SOL;
let godExists = false;
const god = new User();

async function initGod (connection: Connection) {
    const airdropTxn = await connection.requestAirdrop(
        god.publicKey,
        MAX_DEVNET_AIRDROP,
    );
    await connection.confirmTransaction(airdropTxn);
    const ata = await spl.Token.getAssociatedTokenAddress(
        spl.ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
        spl.TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
        spl.NATIVE_MINT, // mint
        god.publicKey // owner
    );
    // create associated token account for wSOL
    await sendAndConfirmTransaction(connection, 
        new Transaction().add(
          spl.Token.createAssociatedTokenAccountInstruction(
            spl.ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
            spl.TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
            spl.NATIVE_MINT,      // mint
            ata,                  // ata
            god.publicKey,        // owner of token account
            god.publicKey         // fee payer
          )
        ),
        [god.keypair]
      );
    godExists = true;
    god.mintTokenAccount = ata;
}

async function bulkAirdrop(connection: Connection, users: User[]) {
    if (!godExists) {
        await initGod(connection);
    }
    const txn = new Transaction();
    for (let i = 0; i < users.length; i++) {
        txn.add(
            // trasnfer SOL
            SystemProgram.transfer({
                fromPubkey: god.publicKey,
                toPubkey: users[i].publicKey,
                lamports: 0.2 * LAMPORTS_PER_SOL,
            }),
        )
    }
    await sendAndConfirmTransaction(
        connection,
        txn,
        [god.keypair]
    )
}

async function transferLamportsToWSOL (connection: Connection, auth: anchor.web3.Keypair, toTokenAcc: anchor.web3.PublicKey, amount: number) {
    console.log("Transfer SOL to TokenAccount")
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        // transfer SOL
        SystemProgram.transfer({
          fromPubkey: auth.publicKey,
          toPubkey: toTokenAcc,
          lamports: amount,
        }),
        new TransactionInstruction({
          keys: [
            {
              pubkey: toTokenAcc,
              isSigner: false,
              isWritable: true,
            },
          ],
          data: Buffer.from(new Uint8Array([17])),
          programId: spl.TOKEN_PROGRAM_ID,
        })
      ),
      [auth],
    );
}

// Solana
async function assertAccountDetailsAreCorrect(
    connection: Connection,
    accountPubKey: anchor.web3.PublicKey,
    expectedOwner: anchor.web3.PublicKey,
    expectedSpace: number, 
) {
    const account = await connection.getAccountInfo(
        accountPubKey
    );
    assert(expectedOwner.equals(account.owner), "expectedOwner is not owner of account");

    const space = account.data.byteLength;
    assert.equal(expectedSpace, space, `expectedSpace (${expectedSpace}) is not equal to actual space (${space}) of account`);

    const minRent = await connection.getMinimumBalanceForRentExemption(space);
    assert(account.lamports >= minRent);  // must be under space == actualSpace check
}

// Logic
function calculateExpectedAccrueSupplyMinted(
    poolBefore: anchor.BN, 
    accrueMintSupplyBefore: anchor.BN, 
    depositAmount: anchor.BN,
): anchor.BN {
    if (poolBefore.isZero()) {
        return depositAmount;
    } else {
        return depositAmount.mul(accrueMintSupplyBefore).div(poolBefore);
    }
}


export {
    god,
    sleep,
    assertSimulationError,
    bn,
    U64_MAX,
    transferLamportsToWSOL,
    assertAccountDetailsAreCorrect,
    calculateExpectedAccrueSupplyMinted,
    convertStrToUint8,
    bulkAirdrop,
}