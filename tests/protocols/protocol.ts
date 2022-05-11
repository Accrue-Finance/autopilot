import { PublicKey } from "@solana/web3.js";
import { SolendProtocol } from "./solend/classes";


export const DEST_COLLATERAL_SEED = "DSTC";

// used for tests
export const PYTH_ORACLE_MAINNET = new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"); 
export const SWITCHBOARD_ORACLE_MAINNET = new PublicKey("DtmE9D2CSB4L5D6A15mraeEjrGMm6auWVzgaD8hK2tZM");

export type Protocol = SolendProtocol;