import net from 'node:net';
import path from 'node:path';
import * as ecc from '@bitcoinerlab/secp256k1';
import { initEccLib, networks, type Network } from 'bitcoinjs-lib';

// Node gives each connection attempt only 250ms by default; slow or busy networks need longer
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

// Give bitcoinjs the secp256k1 curve math; it needs it to read Taproot (tb1p...) addresses
initEccLib(ecc);

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const ENV_PATH = path.join(ROOT, '.env');

// Load .env into process.env (it's fine if it doesn't exist yet)
try {
  process.loadEnvFile(ENV_PATH);
} catch {}

interface NetworkConfig {
  name: string;
  api: string; // Esplora API that answers questions and broadcasts for us
  explorer: string; // website where humans can look at txs and addresses
  faucet: string; // website that hands out free test coins
  blockTime: string; // roughly how long until a new block confirms your tx
  params: Network; // address and key formats (tb1..., testnet WIF)
}

const NETWORKS: Record<string, NetworkConfig> = {
  mutinynet: {
    name: 'Mutinynet',
    api: 'https://mutinynet.com/api',
    explorer: 'https://mutinynet.com',
    faucet: 'https://faucet.mutinynet.com',
    blockTime: '30 seconds',
    params: networks.testnet,
  },
  signet: {
    name: 'Signet',
    api: 'https://blockstream.info/signet/api',
    explorer: 'https://blockstream.info/signet',
    faucet: 'https://signetfaucet.com',
    blockTime: '10 minutes',
    params: networks.testnet,
  },
};

const choice = (process.env.NETWORK || 'mutinynet').trim().toLowerCase();
if (!NETWORKS[choice]) {
  console.error(`Unknown NETWORK "${choice}" in .env. Use one of: ${Object.keys(NETWORKS).join(', ')}`);
  process.exit(1);
}

export const NETWORK = NETWORKS[choice];
export const FEE_RATE = Number(process.env.FEE_RATE || 2);

export const txLink = (txid: string) => `${NETWORK.explorer}/tx/${txid}`;
export const addressLink = (address: string) => `${NETWORK.explorer}/address/${address}`;
