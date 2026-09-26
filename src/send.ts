// Send sats, optionally with an OP_RETURN message:
//   npm run send -- <address | me> <sats> "your message" [--dry-run]
import { FEE_RATE, NETWORK } from './lib/config.js';
import { getUtxos } from './lib/esplora.js';
import { loadWallet } from './lib/key.js';
import { buildTx, sum, sweepTx } from './lib/tx.js';
import { checkAddress, fail, printSummary, run, sendOrPreview, warnIfBigMessage } from './lib/cli.js';

run(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const [to, amount, ...words] = args.filter((a) => a !== '--dry-run');
  const message = words.join(' ') || undefined;

  if (!to || !amount) fail('Usage: npm run send -- <address | me> <sats | all> "optional message" [--dry-run]');

  const wallet = loadWallet();
  const address = to === 'me' ? wallet.address : to;
  // "all" empties the wallet: everything except the fee goes to one address
  const sweep = amount === 'all';
  const sats = Number(amount);
  checkAddress(address);
  if (!sweep && (!Number.isInteger(sats) || sats <= 0)) fail(`"${amount}" isn't a whole number of sats, or the word "all".`);
  if (message) warnIfBigMessage(message);

  // 1. Ask the network which coins we own
  const utxos = await getUtxos(wallet.address);
  if (utxos.length === 0) fail(`No UTXOs found. Get coins from the host or ${NETWORK.faucet} first.`);

  // 2. Build and sign the transaction on this laptop (the key never leaves it)
  const built = sweep
    ? sweepTx({ wallet, utxos, address, message, feeRate: FEE_RATE })
    : buildTx({ wallet, utxos, payments: [{ address, sats }], message, feeRate: FEE_RATE });
  printSummary(built, [{ address, sats: sweep ? sum(utxos.map((c) => c.value)) - built.fee : sats }], message);

  // 3. Show it byte by byte, or hand it to the network
  await sendOrPreview(built.tx, dryRun, wallet.address);
});
