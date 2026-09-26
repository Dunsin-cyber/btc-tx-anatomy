// Host only: pay every attendee in ONE transaction with many outputs
//   npm run airdrop -- addresses.txt [sats each] ["message"] [--dry-run]
import fs from 'node:fs';
import { FEE_RATE, NETWORK } from './lib/config.js';
import { getUtxos } from './lib/esplora.js';
import { loadWallet } from './lib/key.js';
import { buildTx } from './lib/tx.js';
import { fail, fmt, isValidAddress, printSummary, run, sendOrPreview, warnIfBigMessage } from './lib/cli.js';

run(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const [file, amount = '10000', ...words] = args.filter((a) => a !== '--dry-run');
  const message = words.join(' ') || undefined;

  if (!file) fail('Usage: npm run airdrop -- addresses.txt [sats each] ["message"] [--dry-run]');
  if (!fs.existsSync(file)) fail(`Can't find ${file}. Put one address per line in it.`);
  const sats = Number(amount);
  if (!Number.isInteger(sats) || sats <= 0) fail(`"${amount}" isn't a whole number of sats.`);
  if (message) warnIfBigMessage(message);

  // One address per line; blank lines, # comments and duplicates are ignored
  const lines = fs.readFileSync(file, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
  const addresses = [...new Set(lines)];
  const valid = addresses.filter(isValidAddress);
  const skipped = addresses.filter((a) => !isValidAddress(a));
  if (skipped.length) console.log(`\nSkipping ${skipped.length} address(es) that aren't valid on ${NETWORK.name}:\n  ${skipped.join('\n  ')}`);
  if (valid.length === 0) fail('No valid addresses to pay.');

  const wallet = loadWallet();
  const utxos = await getUtxos(wallet.address);
  if (utxos.length === 0) fail(`The host wallet is empty. Fund ${wallet.address} from ${NETWORK.faucet} first.`);

  const payments = valid.map((address) => ({ address, sats }));
  const built = buildTx({ wallet, utxos, payments, message, feeRate: FEE_RATE });
  printSummary(built, payments, message);
  console.log(`\n${valid.length} people paid in 1 transaction, ${fmt(valid.length * sats)} sats in total`);

  await sendOrPreview(built.tx, dryRun, wallet.address);
});

