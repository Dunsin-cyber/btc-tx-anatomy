import * as bitcoin from 'bitcoinjs-lib';
import { NETWORK } from './config.js';
import type { Utxo } from './esplora.js';
import type { Wallet } from './key.js';

export interface Payment {
  address: string;
  sats: number;
}

export interface BuiltTx {
  tx: bitcoin.Transaction;
  inputs: Utxo[];
  fee: number;
  change: number;
}

// Change smaller than this isn't worth creating, so it goes to the fee instead
export const DUST_LIMIT = 546;

// Sequence 0xfffffffd says "I may replace this with a higher fee version later" (RBF)
const RBF_SEQUENCE = 0xfffffffd;

// OP_RETURN output: an unspendable output that carries our message
export function opReturnScript(message: string): Uint8Array {
  return bitcoin.payments.embed({ data: [new TextEncoder().encode(message)] }).output!;
}

// Pick coins, pay everyone, attach the message, pay the fee, send the rest back as change
export function buildTx(opts: { wallet: Wallet; utxos: Utxo[]; payments: Payment[]; message?: string; feeRate: number }): BuiltTx {
  const { wallet, utxos, payments, message, feeRate } = opts;
  const paying = sum(payments.map((p) => p.sats));

  // Spend your biggest coins first, adding one more until they cover payments plus fee
  const coins = [...utxos].sort((a, b) => b.value - a.value);
  for (let n = 1; n <= coins.length; n++) {
    const inputs = coins.slice(0, n);
    const leftover = sum(inputs.map((c) => c.value)) - paying;
    if (leftover <= 0) continue;

    // Sign a draft to learn the exact size, because the fee is priced per vbyte
    const draft = sign(wallet, inputs, payments, message, leftover);
    const fee = Math.ceil(draft.virtualSize() * feeRate);
    const change = leftover - fee;
    if (change < 0) continue;

    if (change < DUST_LIMIT) {
      return { tx: sign(wallet, inputs, payments, message, 0), inputs, fee: leftover, change: 0 };
    }
    return { tx: sign(wallet, inputs, payments, message, change), inputs, fee, change };
  }

  const have = sum(utxos.map((c) => c.value));
  throw new Error(`Not enough coins: you're paying ${paying} sats plus a fee, but you only have ${have} sats`);
}

// Empty the wallet: spend every coin into one output, with no change left behind
export function sweepTx(opts: { wallet: Wallet; utxos: Utxo[]; address: string; message?: string; feeRate: number }): BuiltTx {
  const { wallet, utxos, address, message, feeRate } = opts;
  const total = sum(utxos.map((c) => c.value));

  // Draft it once at the full amount to measure the size, then take the fee off the output
  const draft = sign(wallet, utxos, [{ address, sats: total }], message, 0);
  const fee = Math.ceil(draft.virtualSize() * feeRate);
  const sending = total - fee;
  if (sending < DUST_LIMIT) throw new Error(`Only ${total} sats here, and the fee alone is ${fee} sats. Nothing worth sending.`);

  return { tx: sign(wallet, utxos, [{ address, sats: sending }], message, 0), inputs: utxos, fee, change: 0 };
}

// Assemble the transaction as a PSBT, sign every input with our key, and pull out the final tx
function sign(wallet: Wallet, inputs: Utxo[], payments: Payment[], message: string | undefined, change: number) {
  const psbt = new bitcoin.Psbt({ network: NETWORK.params });

  for (const coin of inputs) {
    // witnessUtxo tells the signer how much this coin is worth and what lock it sits behind
    psbt.addInput({
      hash: coin.txid,
      index: coin.vout,
      sequence: RBF_SEQUENCE,
      witnessUtxo: { script: wallet.output, value: BigInt(coin.value) },
    });
  }

  for (const p of payments) psbt.addOutput({ address: p.address, value: BigInt(p.sats) });
  if (message) psbt.addOutput({ script: opReturnScript(message), value: 0n });
  if (change > 0) psbt.addOutput({ address: wallet.address, value: BigInt(change) });

  psbt.signAllInputs(wallet.keyPair);
  psbt.finalizeAllInputs();
  return psbt.extractTransaction();
}

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
