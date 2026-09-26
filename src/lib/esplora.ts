import { NETWORK } from './config.js';

// One coin you own, as the API describes it
export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean; block_height?: number };
}

// The parts of the API's transaction summary we use
export interface TxInfo {
  txid: string;
  fee: number;
  weight: number;
  status: { confirmed: boolean; block_height?: number };
  vin: { is_coinbase: boolean; prevout: { value: number; scriptpubkey_address?: string } | null }[];
  vout: { value: number; scriptpubkey_address?: string }[];
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(NETWORK.api + path, init);
  } catch {
    const other = NETWORK.name === 'Mutinynet' ? 'signet' : 'mutinynet';
    throw new Error(`Could not reach ${NETWORK.api}. Check your internet, or if ${NETWORK.name} is down, set NETWORK=${other} in .env`);
  }
}

async function get(path: string): Promise<Response> {
  const res = await call(path);
  if (!res.ok) throw new Error(`${NETWORK.name} API said ${res.status}: ${(await res.text()).trim()}`);
  return res;
}

export const getUtxos = async (address: string): Promise<Utxo[]> => (await get(`/address/${address}/utxo`)).json();
export const getTx = async (txid: string): Promise<TxInfo> => (await get(`/tx/${txid}`)).json();
export const getTxHex = async (txid: string): Promise<string> => (await get(`/tx/${txid}/hex`)).text();

// Hand a signed transaction to the network; returns its txid
export async function broadcast(hex: string): Promise<string> {
  const res = await call('/tx', { method: 'POST', body: hex });
  const body = (await res.text()).trim();
  if (!res.ok) throw new RejectedError(body);
  return body;
}

// The node refused our transaction; translate its reason into plain English
export class RejectedError extends Error {
  reason: string;
  hint: string;

  constructor(raw: string) {
    const reason = raw.match(/"message":"([^"]+)"/)?.[1] ?? raw;
    super(`The node rejected the transaction: ${reason}`);
    this.reason = reason;
    this.hint = HINTS.find(([pattern]) => pattern.test(reason))?.[1] ?? 'Search for this reason in the README troubleshooting table.';
  }
}

const HINTS: [RegExp, string][] = [
  [/fee not met|insufficient fee/i, 'The fee is too low. Raise FEE_RATE in .env and try again.'],
  [/missingorspent|missing-inputs/i, "One of the coins doesn't exist or is already spent (maybe by your last tx). Run `npm run balance` and try again."],
  [/already known|already in block chain|txn-already/i, 'This exact transaction was already broadcast. Nothing to do.'],
  [/dust/i, 'An output is too small to be worth spending ("dust"). Send at least 1,000 sats.'],
  [/datacarrier|scriptpubkey|multi-op-return/i, "This node's policy refused the OP_RETURN (too big, or too many). That's policy, not consensus: the same tx would still be valid in a block."],
  [/non-final|non-bip68-final/i, "A time lock on this transaction hasn't expired yet."],
];
