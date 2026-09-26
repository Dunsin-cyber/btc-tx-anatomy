import * as bitcoin from 'bitcoinjs-lib';
import { styleText } from 'node:util';
import { NETWORK } from './config.js';

const HEX_WIDTH = 26;
const FIELD_WIDTH = 15;

// Reads a raw transaction front to back, a few bytes at a time
class Reader {
  pos = 0;
  constructor(readonly bytes: Buffer) {}

  take(n: number): Buffer {
    if (this.pos + n > this.bytes.length) throw new Error('The transaction ended early. Is the hex complete?');
    const out = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  peek(): number {
    return this.bytes[this.pos];
  }

  // "Compact size" number: 1 byte if under 253, otherwise a marker byte then 2, 4 or 8 bytes
  varint(): { value: number; raw: Buffer } {
    const start = this.pos;
    const first = this.take(1)[0];
    let value = first;
    if (first === 0xfd) value = this.take(2).readUInt16LE();
    else if (first === 0xfe) value = this.take(4).readUInt32LE();
    else if (first === 0xff) value = Number(this.take(8).readBigUInt64LE());
    return { value, raw: this.bytes.subarray(start, this.pos) };
  }
}

// Print every field of a raw transaction; outputs paying `mine` get marked "← you"
export function explainTx(hex: string, mine?: string) {
  const r = new Reader(Buffer.from(hex, 'hex'));
  let witnessBytes = 0;
  const coinbases: boolean[] = [];

  section('HEADER');
  const versionBytes = r.take(4);
  const version = versionBytes.readUInt32LE();
  row(versionBytes, 'version', `${version} (which set of rules this tx follows)`);

  // A zero where the input count should be means "SegWit tx, witness data included"
  const segwit = r.peek() === 0x00;
  if (segwit) {
    row(r.take(2), 'marker + flag', 'SegWit tx: the signatures come later, in the witness');
    witnessBytes += 2;
  }

  section('INPUTS: which coins are being spent');
  const inCount = r.varint();
  row(inCount.raw, 'input count', `${inCount.value}`);
  for (let i = 0; i < inCount.value; i++) {
    sub(`input ${i}`);
    const prevTxid = r.take(32);
    const vout = r.take(4);
    const coinbase = prevTxid.every((b) => b === 0) && vout.readUInt32LE() === 0xffffffff;
    const shown = Buffer.from(prevTxid).reverse().toString('hex');
    row(prevTxid, 'previous txid', coinbase ? 'none: coinbase tx, creates brand new bitcoin' : `${shown} (explorers show it reversed)`);
    row(vout, 'output index', coinbase ? 'none (ffffffff)' : `spending output #${vout.readUInt32LE()} of that tx`);
    coinbases.push(coinbase);

    const sigLen = r.varint();
    row(sigLen.raw, 'scriptSig size', sigLen.value === 0 && segwit ? '0: empty, the unlock lives in the witness' : `${sigLen.value} bytes`);
    if (sigLen.value > 0) {
      const scriptSig = r.take(sigLen.value);
      row(scriptSig, 'scriptSig', coinbase ? coinbaseHeight(scriptSig) : 'unlocking script (old, pre SegWit style)');
    }

    const seq = r.take(4);
    row(seq, 'sequence', explainSequence(seq.readUInt32LE(), version));
  }

  section('OUTPUTS: where the coins go');
  const outCount = r.varint();
  row(outCount.raw, 'output count', `${outCount.value}`);
  for (let i = 0; i < outCount.value; i++) {
    sub(`output ${i}`);
    const value = r.take(8);
    row(value, 'amount', `${Number(value.readBigUInt64LE()).toLocaleString('en-US')} sats`);
    const len = r.varint();
    row(len.raw, 'script size', `${len.value} bytes`);
    const script = r.take(len.value);
    const you = mine !== undefined && addressOf(script) === mine;
    row(script, 'scriptPubKey', describeScript(script) + (you ? styleText('green', '  ← you') : ''));
  }

  if (segwit) {
    section('WITNESS: the proof you may spend each input');
    for (let i = 0; i < inCount.value; i++) {
      sub(`witness for input ${i}`);
      const start = r.pos;
      const count = r.varint();
      row(count.raw, 'item count', `${count.value}`);
      const items = Array.from({ length: count.value }, () => {
        const len = r.varint();
        return { len, data: r.take(len.value) };
      });
      const labels = witnessLabels(items.map((it) => it.data), coinbases[i]);
      items.forEach((it, k) => {
        row(it.len.raw, 'item size', `${it.len.value} bytes`);
        row(it.data, labels[k][0], labels[k][1]);
      });
      witnessBytes += r.pos - start;
    }
  }

  section('FOOTER');
  const locktime = r.take(4);
  row(locktime, 'locktime', explainLocktime(locktime.readUInt32LE()));

  if (r.pos !== r.bytes.length) throw new Error(`${r.bytes.length - r.pos} unexpected bytes after the locktime`);

  // Witness bytes count 1 weight unit, everything else counts 4: that's the SegWit discount
  const total = r.bytes.length;
  const weight = (total - witnessBytes) * 4 + witnessBytes;
  section('SIZE');
  console.log(`  ${total} bytes in total, ${witnessBytes} of them witness`);
  console.log(`  weight  = ${total - witnessBytes} × 4 + ${witnessBytes} × 1 = ${weight}  (witness data is 75% cheaper)`);
  console.log(`  vbytes  = weight ÷ 4 = ${Math.ceil(weight / 4)}  (fees are priced per vbyte)`);
  console.log(`  txid    = ${bitcoin.Transaction.fromHex(hex).getId()}  (hash of everything except the witness)`);
}

// Name the kind of lock on an output and show the address or message inside it
function describeScript(script: Buffer): string {
  if (script[0] === 0x6a) return describeOpReturn(script);
  const address = addressOf(script);
  return address ? `${scriptKind(script)} lock → ${address}` : `${scriptKind(script)}: ${bitcoin.script.toASM(script)}`;
}

function addressOf(script: Buffer): string | undefined {
  try {
    return bitcoin.address.fromOutputScript(script, NETWORK.params);
  } catch {
    return undefined;
  }
}

function scriptKind(s: Buffer): string {
  if (s.length === 22 && s[0] === 0x00 && s[1] === 0x14) return 'P2WPKH (native SegWit)';
  if (s.length === 34 && s[0] === 0x00 && s[1] === 0x20) return 'P2WSH (SegWit script)';
  if (s.length === 34 && s[0] === 0x51 && s[1] === 0x20) return 'P2TR (Taproot)';
  if (s.length === 25 && s[0] === 0x76 && s[1] === 0xa9) return 'P2PKH (legacy)';
  if (s.length === 23 && s[0] === 0xa9) return 'P2SH';
  return 'non standard';
}

// OP_RETURN: pull out each piece of data and show it as text when it's readable
function describeOpReturn(script: Buffer): string {
  const pushes = (bitcoin.script.decompile(script) ?? []).filter((c): c is Uint8Array => typeof c !== 'number');
  const total = pushes.reduce((n, p) => n + p.length, 0);
  return `OP_RETURN, can never be spent. ${total} bytes of data: ${pushes.map(describePush).join(' + ')}`;
}

// Blocks use OP_RETURN too; recognise their well known prefixes, show anything else as text
function describePush(data: Uint8Array): string {
  const hex = Buffer.from(data).toString('hex');
  if (hex.startsWith('aa21a9ed')) return `SegWit witness commitment (fingerprint of every witness in the block)`;
  if (hex.startsWith('ecc7daa2')) return 'signet block signature (proof the block signer made this block)';
  return asText(data);
}

function asText(data: Uint8Array): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    if (!/[\u0000-\u0008\u000e-\u001f\u007f]/.test(text)) return JSON.stringify(text);
  } catch {}
  return `0x${Buffer.from(data).toString('hex')}`;
}

// Name each witness item; a P2WPKH spend is always [signature, public key]
function witnessLabels(items: Uint8Array[], coinbase: boolean): [string, string][] {
  if (coinbase) return [['reserved value', 'coinbase only: mixed into the witness commitment']];
  const isPubkey = (b: Uint8Array) => b.length === 33 && (b[0] === 0x02 || b[0] === 0x03);
  if (items.length === 2 && isPubkey(items[1])) {
    return [
      ['signature', `ECDSA, ends in ${sighashName(items[0][items[0].length - 1])}`],
      ['public key', 'must hash to the pubkey hash in the coin being spent'],
    ];
  }
  if (items.length === 1 && (items[0].length === 64 || items[0].length === 65)) {
    return [['signature', 'Schnorr signature (Taproot key path spend)']];
  }
  return items.map((it, k) => [`item ${k}`, `${it.length} bytes`]);
}

function sighashName(byte: number): string {
  const names: Record<number, string> = {
    0x01: 'ALL: signs every input and output',
    0x02: 'NONE: signs inputs only',
    0x03: 'SINGLE: signs the matching output only',
    0x81: 'ALL|ANYONECANPAY',
    0x82: 'NONE|ANYONECANPAY',
    0x83: 'SINGLE|ANYONECANPAY',
  };
  return `0x${byte.toString(16).padStart(2, '0')} = SIGHASH_${names[byte] ?? 'unknown'}`;
}

// Coinbase scriptSig starts with the block height (BIP34), then anything the miner likes
function coinbaseHeight(scriptSig: Buffer): string {
  const len = scriptSig[0];
  if (len < 1 || len > 8 || scriptSig.length < len + 1) return 'coinbase data: anything the miner likes';
  const height = scriptSig.subarray(1, 1 + len).readUIntLE(0, Math.min(len, 6));
  return `coinbase data: block height ${height.toLocaleString('en-US')}, then anything the miner likes`;
}

function explainSequence(seq: number, version: number): string {
  if (seq === 0xffffffff) return 'final: no RBF, no relative time lock';
  if (seq === 0xfffffffe) return "doesn't signal RBF, but lets the locktime apply";
  const rbf = 'signals RBF: can be replaced by a higher fee version';
  if (seq & 0x80000000 || version < 2) return rbf;
  return `${rbf}, and waits ${seq & 0xffff} ${seq & 0x400000 ? '× 512 seconds' : 'blocks'} after the coin was created`;
}

function explainLocktime(n: number): string {
  if (n === 0) return '0: no time lock, can be mined right away';
  if (n < 500_000_000) return `can't be mined before block ${n}`;
  return `can't be mined before ${new Date(n * 1000).toISOString()}`;
}

function row(bytes: Uint8Array, field: string, meaning = '') {
  let hex = Buffer.from(bytes).toString('hex');
  if (hex.length > HEX_WIDTH) hex = hex.slice(0, HEX_WIDTH - 1) + '…';
  console.log(`  ${styleText('dim', hex.padEnd(HEX_WIDTH))}  ${field.padEnd(FIELD_WIDTH)}  ${meaning}`);
}

const section = (title: string) => console.log(`\n${styleText('bold', styleText('cyan', title))}`);
const sub = (title: string) => console.log(styleText('yellow', `  ── ${title} ──`));
