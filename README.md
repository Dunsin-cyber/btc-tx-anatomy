# Bitcoin Transaction Anatomy: Live Coding

**BitDevs Ibadan · Socratic Seminar · Part 1 · Saturday, September 26, 2026**
Live coding with Dunsin ([@Abisuwa_Dunsin](https://x.com/Abisuwa_Dunsin))

In this session we open up a Bitcoin transaction and look at every part of it. Then we write a message into the blockchain with `OP_RETURN`, and build, sign and broadcast our own transactions live.

You can code along on your own laptop. You **don't** need to run a Bitcoin node, and you **won't** spend real money.

This is a Socratic seminar, so the discussion matters as much as the code. Bring questions.

---

## What we'll cover

| Part | Topic | What you'll see |
|---|---|---|
| 1 | Anatomy of a transaction | A real transaction taken apart byte by byte: version, inputs, outputs, witness, locktime |
| 2 | The magic of OP_RETURN | How people put messages onchain, why it's in the news again, and the difference between "policy" and "consensus" |
| 3 | Live coding a custom transaction | Spend your own coins, attach a message, change it, send coins to other attendees and back to the host |

## What this project does

This project is a small set of TypeScript scripts that talk to a public Bitcoin test network:

| Command | What it does |
|---|---|
| `npm run wallet` | Creates your test wallet (a private key and an address) and saves it in `.env` |
| `npm run balance` | Lists the coins (UTXOs) your address owns |
| `npm run decode -- <txid>` | Downloads any transaction and explains each part of it, byte by byte |
| `npm run send -- <address> <sats> "<message>"` | Builds, signs and broadcasts a transaction, with an optional OP_RETURN message |
| `npm run send -- <address> all "<message>"` | Empties your wallet into one address (everything except the fee). Use it to send leftovers back at the end |
| `npm run send -- me 1000 "gm" --dry-run` | Same, but `me` pays yourself and `--dry-run` shows the signed transaction byte by byte **without** sending it |

**Your private key never leaves your laptop.** The scripts sign locally and only send the finished, signed transaction to the network.

```
 your laptop                         mutinynet.com/api                any browser
 ┌──────────────────────┐  1. which  ┌───────────────────┐           ┌──────────────────┐
 │ build the tx         │  coins do  │ public node       │           │ mutinynet.com    │
 │ add an OP_RETURN     │ ─────────▶ │                   │           │ explorer shows   │
 │ sign with your key   │  I own?    │ checks the tx,    │  ~30 sec  │ your tx and      │
 │ (key stays here)     │ ─────────▶ │ passes it to the  │ ────────▶ │ your message     │
 └──────────────────────┘ 2. send    │ block producer    │           │                  │
                          signed tx  └───────────────────┘           └──────────────────┘
```

## Quick start

Please do the setup **before the meetup** if you can. Installing is the slowest part.

### Option A: in your browser, nothing to install (recommended)

1. You need a free GitHub account.
2. Open this repository on GitHub, click the green **Code** button, open the **Codespaces** tab, then click **Create codespace on main**.
3. Wait for it to load. It runs `npm install` and creates your `.env` for you.
4. In the terminal at the bottom of the screen, run `npm run wallet`.

### Option B: on your own laptop

You need **Node.js 22 or newer** (run `node -v` to check) and **git**. If you use nvm, `nvm use` picks the right version from `.nvmrc`.

```bash
git clone <this-repo-url>
cd btc-tx-anatomy
npm install
cp .env.example .env
npm run wallet
```

### Then, for everyone

1. `npm run wallet` prints your address. It starts with `tb1q`.
2. Get some free test coins in one of two ways:
   - paste your address in the meetup chat and the host will send you some, **or**
   - use the Mutinynet faucet at <https://faucet.mutinynet.com>. It asks you to **sign in with GitHub** (to stop bots draining it), then sends up to 1,000,000 sats per request.
3. Wait about 30 seconds, then run `npm run balance`.
4. If you see a coin listed, you're ready.

## Credentials: what you need and why

**No API keys and no signups for the code.** The blockchain API we use is public and free.

You only need a **GitHub account** if you want to use Codespaces (Option A) or get coins from the faucet yourself. No GitHub account? No problem: run the code locally and get your coins from the host.

The only secret in this project is **your test wallet's private key**, and the scripts create it for you.

Your `.env` file holds:

| Setting | What it is | Where it comes from |
|---|---|---|
| `NETWORK` | Which test network to use: `mutinynet` (default) or `signet` (backup) | Already set in `.env.example` |
| `WIF` | Your private key, written in "Wallet Import Format", a standard way to write a key as text | `npm run wallet` creates it |
| `FEE_RATE` | How many sats per vbyte you pay in fees when sending | Already set in `.env.example` |

```bash
# .env.example
# Which test network to use: mutinynet (default, ~30s blocks) or signet (backup, ~10 min blocks)
NETWORK=mutinynet

# Your test wallet's private key. Leave it empty: `npm run wallet` fills it in
WIF=

# Fee you pay when sending, in sats per vbyte
FEE_RATE=2
```

### Why do I need a private key?

Bitcoin has no usernames or passwords. Every coin is locked with a small puzzle, and only your private key can solve it. To spend a coin, you produce a **digital signature** with that key. Everyone can check the signature, but nobody can forge it without the key.

Think of it as a padlocked box. Anyone can see the box and drop money into it (that's your **address**), but only your key can open it (that's your **private key**).

### Safety rules (yes, even with test coins)

- `.env` is listed in `.gitignore`, so git will never upload it. Don't remove that line.
- Never paste your `WIF` into the chat, and don't show your `.env` on a screen share.
- **Never** put a real (mainnet) private key or seed phrase into this project, and never send real bitcoin to these addresses. Addresses starting with `tb1` are for test networks only.
- If you think your key has leaked, delete the `WIF` value and run `npm run wallet` again. A new one is free.

## Which blockchain are we using, and why?

We're using **Mutinynet**, a public Bitcoin test network.

| Network | Why not, for a live session? |
|---|---|
| Mainnet (real Bitcoin) | Real money and real fees. One typo loses real sats. |
| Regtest | Runs only on one laptop. Nobody else can join. |
| Testnet4 / public Signet | Public and free, but a block only every ~10 minutes (sometimes 20+). Too slow to watch live. |
| **Mutinynet** ✅ | Public, free coins, and a new block about every **30 seconds**. Your transaction confirms while we're still talking about it. |

Mutinynet is a **signet**. It follows Bitcoin's rules, but instead of open mining, a known party signs each block. That keeps it stable, and it keeps the coins worthless, which is what we want for learning.

**You don't run a node.** The scripts talk to a public **Esplora API**, a web server that answers blockchain questions ("which coins does this address own?") and accepts signed transactions to broadcast. Anyone can use it, which is why everyone in the room can take part.

**Backup plan:** Mutinynet is run by one team. If it's down on the day, change one line in `.env`:

```bash
NETWORK=signet
```

This points the scripts at the public Signet API at `blockstream.info/signet/api`. It works the same way, but blocks are slower. Your wallet and address stay the same, but coins are separate: Mutinynet coins don't exist on Signet.

## A quick word on OP_RETURN

`OP_RETURN` is a special kind of output that means "this can never be spent". Nobody can ever spend it, so nodes don't need to keep track of it forever. That makes it the "polite" place to put data onchain: a short message, the fingerprint (hash) of a document, or proof that something existed at a certain time.

**Why it's in the news:** for years, Bitcoin Core nodes would only pass along OP_RETURN outputs holding up to **80 bytes** of data. **Bitcoin Core v30** (October 2025) raised that default to about **100,000 bytes**. Some node runners responded by switching to **Bitcoin Knots**, which filters these messages out. The debate is about whether nodes should help spread large amounts of non payment data.

The key idea we'll explore live is that the 80 byte limit is **policy**, not **consensus**:

- **Consensus** means the rules that decide whether a block is valid. Break them and every node on the network rejects your block.
- **Policy** means each node's own choice about which *unconfirmed* transactions it passes along. A node can refuse to relay a transaction that would still be perfectly valid inside a block.

During the session we'll send an 80 byte message, which basically every node accepts. Then we'll try a bigger one and read what the node says back.

**Tested on Mutinynet on 26 September 2026:** 200 byte and 500 byte messages were both **accepted** and confirmed, so Mutinynet does not enforce the old 80 byte limit. Its node reports Bitcoin Core 29.2, which would normally refuse them, so whoever runs it raised the limit deliberately. The lesson stands, and it's a sharper one: the limit is a setting each node operator chooses, not a rule of Bitcoin.

**A display trick worth showing.** The raw script is `6a` (OP_RETURN) + a length byte + your text. Explorers that read the whole script as text print `j`, then a box for the length byte, then your message, because those two bytes were never letters. Make your message **exactly 32 bytes** and the length byte becomes `0x20`, a space, so even the raw view reads cleanly: `j gm BitDevs Ibadan 26 Sep 2026!!!`

## Project layout

```
btc-tx-anatomy/
├── src/
│   ├── wallet.ts        npm run wallet   create your key, show how the address is made
│   ├── balance.ts       npm run balance  list your coins (UTXOs)
│   ├── decode.ts        npm run decode   take any transaction apart byte by byte
│   ├── send.ts          npm run send     pay someone, with an optional OP_RETURN message
│   ├── airdrop.ts       npm run airdrop  host only: pay many attendees in one transaction
│   └── lib/             the building blocks those commands use
│       ├── config.ts    network settings (Mutinynet or Signet) and links
│       ├── esplora.ts   tiny client for the public blockchain API
│       ├── key.ts       turns the WIF in .env into a key pair and a tb1q address
│       ├── tx.ts        ★ picks coins, adds outputs, prices the fee, signs
│       ├── anatomy.ts   ★ reads raw transaction bytes and labels every field
│       └── cli.ts       friendly errors, summaries, dry run or broadcast
├── .env.example         copy to .env; holds your network, key and fee rate
└── package.json
```

The two ★ files are where the live coding happens: `anatomy.ts` for Part 1 and `tx.ts` for Part 3.

### Libraries we use, and why

| Library | Why |
|---|---|
| [`bitcoinjs-lib`](https://github.com/bitcoinjs/bitcoinjs-lib) | Builds and serializes transactions. It's the most widely used Bitcoin library for JavaScript. |
| [`ecpair`](https://github.com/bitcoinjs/ecpair) | Creates key pairs and reads and writes keys in WIF format |
| [`@bitcoinerlab/secp256k1`](https://github.com/bitcoinerlab/secp256k1) | The elliptic curve math behind Bitcoin signatures. It's pure JavaScript, so `npm install` never needs a C compiler. |
| [`tsx`](https://github.com/privatenumber/tsx) | Runs TypeScript directly, with no build step |

## Glossary

| Word | Plain English |
|---|---|
| **Transaction (tx)** | A signed message that moves bitcoin: "take these coins and send them here" |
| **txid** | A transaction's ID, made by hashing its contents. Change one byte and you get a completely different txid. |
| **UTXO** | "Unspent Transaction Output": one coin you own. Your balance is all your UTXOs added up. |
| **Input** | A coin (UTXO) being spent |
| **Output** | A new coin being created, locked to someone's address |
| **Change** | The leftover part of an input you send back to yourself. Like paying with a ₦1,000 note for something that costs ₦700: you can't tear the note, so you hand it over and get ₦300 back. |
| **Fee** | Inputs minus outputs. Whatever you don't assign to an output goes to whoever makes the block. |
| **sats** | Satoshis, the smallest unit. 1 BTC = 100,000,000 sats. |
| **scriptPubKey** | The lock on an output: the puzzle someone must solve to spend it |
| **Witness** | The solution to the puzzle (your signature and public key). SegWit transactions keep it in its own section. |
| **vbyte / fee rate** | Transaction size in "virtual bytes". The fee rate is sats paid per vbyte. |
| **Mempool** | The waiting room of transactions that aren't in a block yet |
| **Faucet** | A website that gives out free test coins |
| **Explorer** | A website for looking up transactions and addresses ([mutinynet.com](https://mutinynet.com)) |
| **P2WPKH** | The address type we use ("native SegWit"). It starts with `tb1q` on test networks and `bc1q` on mainnet. |

## Troubleshooting

| You see | What it means | Fix |
|---|---|---|
| `No UTXOs found` | Your address has no coins yet | Get coins from the host or the faucet, wait ~30 seconds, try again |
| `min relay fee not met` | Your fee is too low | Raise `FEE_RATE` in `.env` |
| `bad-txns-inputs-missingorspent` | You tried to spend a coin that doesn't exist or is already spent | Run `npm run balance` again and use fresh coins |
| `dust` | One of your outputs is too small to be worth spending | Send at least 1,000 sats |
| `scriptpubkey` or `datacarrier` | The node refused your OP_RETURN because it's too big for its policy | That's part of the lesson! Shorten the message, or talk about why |
| `Could not reach ...` | Your internet dropped, or the API is down | Check your connection, then set `NETWORK=signet` in `.env` |
| `isn't a valid Mutinynet address` | You used a mainnet (`bc1...`) address or made a typo | Use a test address starting with `tb1` |
| `WIF` missing or invalid | `.env` wasn't created, or the key got cut off when copying | Run `cp .env.example .env` then `npm run wallet` |

## Code along challenges

Try these during the session. Each one proves you understood one idea.

1. **Find yourself.** Run `npm run decode -- <txid>` on the transaction that funded you. Which output is yours? How can you tell?
2. **Read your own message.** Send a message to yourself with `npm run send -- me 1000 "gm bitdevs ibadan"`, then decode it. Find your message's bytes in the OP_RETURN output: `676d` is "gm".
3. **Change one letter.** Run the same command with `--dry-run` twice, once with "gm" and once with "gn". Compare the two txids. Why does one letter change the whole thing?
4. **Push the limit.** Send an 80 byte message, then a 200 byte one, then a 500 byte one. On Mutinynet all three are accepted (we tested). Why does that not mean "Bitcoin allows 500 bytes"?
5. **Feel the fee.** Dry run the same send with `FEE_RATE=1` and then `FEE_RATE=10` in `.env`. What changes in the output, and what stays the same?
6. **Make the message show properly.** Send a message that is **exactly 32 bytes** and look at the raw script on the explorer. The box that usually appears before your text is gone. Why? (Hint: the byte that says how long your message is happens to be a space.)
7. **Send it home.** Send some sats back to the host's address (shared on the day) with a message for everyone to see on the explorer:

```bash
npm run send -- <host address> 2000 "thanks for the session"
```

8. **Empty your wallet.** At the end, send everything that's left in one go. `all` works out the fee for you and leaves no change behind:

```bash
npm run send -- tb1qmt3ue2senlg6ddgmr76hwsk0rdvdk4rgeaen7l all "gm from ibadan"
```

## After the session

- Keep playing. Your test wallet still works after the meetup.
- Don't need your coins anymore? Send them back to the faucet so the next learner can use them. Its page lists a "send back your unused sats" address, currently `tb1qmt3ue2senlg6ddgmr76hwsk0rdvdk4rgeaen7l`:

```bash
npm run send -- tb1qmt3ue2senlg6ddgmr76hwsk0rdvdk4rgeaen7l all "thanks for the sats"
```

## For the host

- **The day before:** run `npm run wallet`, then fund the host wallet from the faucet (sign in with GitHub, up to 1,000,000 sats per request). Also fund the same address on Signet in case Mutinynet is down.
- **The morning of:** run `npm run balance` and `NETWORK=signet npm run balance` to confirm both APIs are up.
- **On the call:** paste attendee addresses from the chat into `addresses.txt` (one per line; duplicates and invalid ones are skipped). Run `npm run airdrop -- addresses.txt 10000 "welcome to bitdevs ibadan" --dry-run` to preview, then run it again without `--dry-run` to pay everyone in **one** transaction with many outputs. That transaction is a lesson in itself.
- **Screen sharing:** keep `.env` closed.
- **At the end:** ask everyone to return what they didn't spend, then empty the host wallet the same way:

```bash
npm run send -- tb1qmt3ue2senlg6ddgmr76hwsk0rdvdk4rgeaen7l all "thanks mutinynet"
```

## Learn more

- [Learn Me A Bitcoin: Transactions](https://learnmeabitcoin.com/technical/transaction/): friendly byte by byte explanations
- [Mastering Bitcoin](https://github.com/bitcoinbook/bitcoinbook): free book, see the chapters on transactions and scripts
- [Esplora API docs](https://github.com/Blockstream/esplora/blob/master/API.md): every endpoint our scripts use
- [Bitcoin Core 30.0 release notes](https://bitcoincore.org/en/releases/30.0/): the OP_RETURN policy change
