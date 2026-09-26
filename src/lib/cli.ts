import * as bitcoin from 'bitcoinjs-lib';
import { NETWORK, txLink } from './config.js';
import { broadcast, RejectedError } from './esplora.js';
import { explainTx } from './anatomy.js';
import { sum, type BuiltTx, type Payment } from './tx.js';

export const fmt = (n: number) => n.toLocaleString('en-US');

// Run a command and show errors as one friendly line instead of a stack trace
export function run(main: () => Promise<void>) {
  main().catch((err: Error) => {
    console.error(`\n✗ ${err.message}`);
    if (err instanceof RejectedError) console.error(`  ${err.hint}`);
    process.exit(1);
  });
}

// Stop early with a readable message when the user typed something off
export function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// Does this address belong to our test network? (mainnet bc1... addresses don't)
export function isValidAddress(address: string): boolean {
  try {
    bitcoin.address.toOutputScript(address, NETWORK.params);
    return true;
  } catch {
    return false;
  }
}

export function checkAddress(address: string) {
  if (!isValidAddress(address)) fail(`"${address}" isn't a valid ${NETWORK.name} address. Test addresses start with tb1.`);
}

// Warn before trying a message bigger than the old 80 byte OP_RETURN limit
export function warnIfBigMessage(message: string) {
  const size = Buffer.byteLength(message);
  if (size <= 80) return;
  console.log(`\nHeads up: your message is ${size} bytes, over the old 80 byte OP_RETURN limit.`);
  console.log('Nodes on Bitcoin Core v30+ relay it by default; older Core versions and Knots refuse it. Let\'s see what this node says.');
}

// Show what the transaction does in plain words before it goes anywhere
export function printSummary(built: BuiltTx, payments: Payment[], message?: string) {
  const vbytes = built.tx.virtualSize();
  console.log(`\nSpending  ${built.inputs.length} coin(s) worth ${fmt(sum(built.inputs.map((c) => c.value)))} sats`);
  for (const p of payments) console.log(`Paying    ${fmt(p.sats)} sats → ${p.address}`);
  if (message) console.log(`Message   ${JSON.stringify(message)} (${Buffer.byteLength(message)} bytes in an OP_RETURN output)`);
  console.log(`Change    ${built.change ? `${fmt(built.change)} sats back to you` : 'none (the leftover was too small, so it goes to the fee)'}`);
  console.log(`Fee       ${fmt(built.fee)} sats for ${vbytes} vbytes (${(built.fee / vbytes).toFixed(1)} sat/vB)`);
}

// --dry-run shows the finished transaction byte by byte; otherwise we broadcast it
export async function sendOrPreview(tx: bitcoin.Transaction, dryRun: boolean, mine: string) {
  if (dryRun) {
    explainTx(tx.toHex(), mine);
    console.log(`\nRaw transaction (signed, ready to broadcast):\n${tx.toHex()}`);
    console.log('\nDry run: nothing was broadcast. Run the same command without --dry-run to send it.');
    return;
  }
  const txid = await broadcast(tx.toHex());
  console.log(`\n✓ Broadcast! txid ${txid}`);
  console.log(`  Watch it confirm: ${txLink(txid)}`);
  console.log(`  Look inside it:   npm run decode -- ${txid}`);
}
