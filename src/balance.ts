// List the coins (UTXOs) your address owns:  npm run balance
import { NETWORK, addressLink } from './lib/config.js';
import { getUtxos } from './lib/esplora.js';
import { loadWallet } from './lib/key.js';
import { sum } from './lib/tx.js';
import { fmt, run } from './lib/cli.js';

run(async () => {
  const wallet = loadWallet();
  const utxos = await getUtxos(wallet.address);

  console.log(`\nNetwork:   ${NETWORK.name}`);
  console.log(`Address:   ${wallet.address}`);
  console.log(`Explorer:  ${addressLink(wallet.address)}\n`);

  if (utxos.length === 0) {
    console.log(`No UTXOs found. Get coins from the host or ${NETWORK.faucet}, wait about ${NETWORK.blockTime}, then try again.\n`);
    return;
  }

  // You don't have "a balance"; you have separate coins, each one an output of some earlier tx
  console.log(`You own ${utxos.length} coin(s), each named <txid that created it>:<output number>\n`);
  for (const coin of utxos.sort((a, b) => b.value - a.value)) {
    const status = coin.status.confirmed ? `confirmed in block ${coin.status.block_height}` : 'waiting in the mempool';
    console.log(`  ${fmt(coin.value).padStart(12)} sats   ${coin.txid}:${coin.vout}   ${status}`);
  }
  console.log(`  ${'─'.repeat(12)}\n  ${fmt(sum(utxos.map((c) => c.value))).padStart(12)} sats total\n`);
});
