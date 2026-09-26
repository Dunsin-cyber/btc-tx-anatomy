// Create your test wallet, or show the one you already have:  npm run wallet
import fs from 'node:fs';
import path from 'node:path';
import * as bitcoin from 'bitcoinjs-lib';
import { ENV_PATH, NETWORK, ROOT, addressLink } from './lib/config.js';
import { ECPair, loadWallet, walletFromKey } from './lib/key.js';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

let wallet;
if (process.env.WIF?.trim()) {
  wallet = loadWallet();
  console.log('\nYou already have a wallet (its key is in .env).');
} else {
  // A private key is just a random 256 bit number; the randomness is what keeps it secret
  const keyPair = ECPair.makeRandom({ network: NETWORK.params });
  saveWif(keyPair.toWIF());
  wallet = walletFromKey(keyPair);
  console.log('\nNew wallet created. Your private key is saved in .env. Never share it or show it on screen.');
}

console.log(`
How your address is made, one step at a time:
  private key  secret random number, saved as WIF in .env (not shown here)
  public key   ${hex(wallet.keyPair.publicKey)}
               = private key × G on the secp256k1 curve (easy forwards, impossible backwards)
  pubkey hash  ${hex(bitcoin.crypto.hash160(wallet.keyPair.publicKey))}
               = RIPEMD160(SHA256(public key)), 20 bytes
  lock script  ${hex(wallet.output)}
               = 00 (SegWit v0) + 14 (push 20 bytes) + pubkey hash. This is what the blockchain stores
  address      ${wallet.address}
               = the lock script written in bech32 so humans can copy it safely

Network:   ${NETWORK.name}
Address:   ${wallet.address}
Explorer:  ${addressLink(wallet.address)}

Next: Use ${NETWORK.faucet} to fund the address
Then run:  npm run balance
`);

// Write WIF=... into .env, starting from .env.example if .env is missing or empty
function saveWif(wif: string) {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const example = path.join(ROOT, '.env.example');
  let text = current.trim() ? current : fs.existsSync(example) ? fs.readFileSync(example, 'utf8') : '';
  text = /^WIF=.*$/m.test(text) ? text.replace(/^WIF=.*$/m, `WIF=${wif}`) : `${text.trimEnd()}\nWIF=${wif}\n`.trimStart();
  fs.writeFileSync(ENV_PATH, text, { mode: 0o600 });
}
