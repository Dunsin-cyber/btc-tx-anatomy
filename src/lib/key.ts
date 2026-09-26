import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory, type ECPairInterface } from 'ecpair';
import { NETWORK } from './config.js';

// Key maker that uses the secp256k1 curve, the same math every Bitcoin wallet uses
export const ECPair = ECPairFactory(ecc);

export interface Wallet {
  keyPair: ECPairInterface; // private key (secret) + public key
  address: string; // tb1q... what you share so people can pay you
  output: Uint8Array; // the lock script your coins sit behind: 0014 + pubkey hash
}

// Turn a key pair into a native SegWit (P2WPKH) wallet
export function walletFromKey(keyPair: ECPairInterface): Wallet {
  const payment = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: NETWORK.params });
  return { keyPair, address: payment.address!, output: payment.output! };
}

// Read the WIF from .env and rebuild the wallet from it
export function loadWallet(): Wallet {
  const wif = process.env.WIF?.trim();
  if (!wif) {
    console.error('No WIF in .env yet. Create your wallet first: npm run wallet');
    process.exit(1);
  }
  try {
    return walletFromKey(ECPair.fromWIF(wif, NETWORK.params));
  } catch {
    console.error('The WIF in .env is not a valid test network key. Clear the WIF= line and run: npm run wallet');
    process.exit(1);
  }
}
