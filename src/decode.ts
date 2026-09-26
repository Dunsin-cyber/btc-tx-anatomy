// Take any transaction apart byte by byte:  npm run decode -- <txid or raw hex>
import { txLink } from './lib/config.js';
import { getTx, getTxHex } from './lib/esplora.js';
import { loadWallet } from './lib/key.js';
import { explainTx } from './lib/anatomy.js';
import { sum } from './lib/tx.js';
import { fail, fmt, run } from './lib/cli.js';

run(async () => {
  const input = process.argv[2]?.trim();
  if (!input) fail('Usage: npm run decode -- <txid or raw transaction hex>');
  if (!/^([0-9a-f]{2})+$/i.test(input)) fail("That doesn't look like a txid or transaction hex (only 0-9 and a-f).");

  // If you have a wallet, we can point out which parts of the tx are yours
  const me = process.env.WIF?.trim() ? loadWallet().address : undefined;

  // A txid is always 64 hex characters; a full transaction is much longer
  const isTxid = input.length === 64;
  explainTx(isTxid ? await getTxHex(input) : input, me);
  if (!isTxid) return;

  const info = await getTx(input);
  console.log(`\nSTATUS  ${info.status.confirmed ? `confirmed in block ${info.status.block_height}` : 'waiting in the mempool'}`);
  console.log(`        ${txLink(input)}`);
  if (info.vin.some((v) => v.is_coinbase)) return;

  // Inputs belong to whoever built and signed this tx; outputs belong to whoever receives them
  const youSent = me !== undefined && info.vin.some((v) => v.prevout?.scriptpubkey_address === me);
  const payer = youSent ? 'you' : me ? 'the sender' : 'whoever owned the inputs';
  if (me) {
    console.log(`\nWHO'S WHO`);
    console.log(youSent ? '  sender    you: your coins are the inputs' : `  sender    someone else: the ${info.vin.length} input(s) are their coins, only they could sign for them`);
    info.vout.forEach((v, i) => {
      if (v.scriptpubkey_address === me) console.log(`  you       output #${i}: ${fmt(v.value)} sats${youSent ? ' (back to you)' : ''}`);
    });
    if (!youSent && !info.vout.some((v) => v.scriptpubkey_address === me)) console.log("  you       not in this transaction");
  }

  // The fee is written nowhere in the tx: it's whatever the inputs don't hand to an output
  const inputs = sum(info.vin.map((v) => v.prevout?.value ?? 0));
  const outputs = sum(info.vout.map((v) => v.value));
  console.log(`\nFEE paid by ${payer} (not written anywhere in the bytes above!)`);
  console.log(`  inputs   ${fmt(inputs)} sats  (${payer === 'you' ? 'your' : "the sender's"} coins, looked up from the txs that created them)`);
  console.log(`  outputs  ${fmt(outputs)} sats  (everything handed out, including change back to ${payer === 'you' ? 'you' : 'the sender'})`);
  console.log(`  fee      ${fmt(info.fee)} sats = inputs − outputs → ${(info.fee / (info.weight / 4)).toFixed(1)} sat/vB`);
});
