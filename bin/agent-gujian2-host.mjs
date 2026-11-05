#!/usr/bin/env node
// bin/agent-gujian2-host.mjs —— 《古剑奇谭二：永夜初晗凝碧天》Stdin/Stdout JSON-Lines 无头智能体宿主
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Gujian2EngineCore, buildProceduralWorldAssets } from '../js/engine_core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] !== undefined) return args[idx + 1];
  return fallback;
}

const mode = getArg('--mode', args.includes('--pure') ? 'pure' : 'normal');
const seed = Number(getArg('--seed', '42')) || 42;
const forceProcedural = args.includes('--procedural');
const assetsDir = getArg('--assets-dir', path.resolve(__dirname, '../assets'));

const metaPath = path.join(assetsDir, 'world.meta.json');
const heightsPath = path.join(assetsDir, 'world.heights.bin');
const propsIndexPath = path.join(assetsDir, 'props', 'index.json');

let meta;
let heights;
let propsIndex = null;

if (!forceProcedural && fs.existsSync(metaPath) && fs.existsSync(heightsPath)) {
  meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const hBuf = fs.readFileSync(heightsPath);
  const u16 = new Uint16Array(hBuf.buffer, hBuf.byteOffset, hBuf.byteLength / 2);
  heights = new Float32Array(u16.length);
  const span = meta.hmax - meta.hmin;
  for (let i = 0; i < u16.length; i++) {
    heights[i] = meta.hmin + (u16[i] / 65535) * span;
  }
  if (fs.existsSync(propsIndexPath)) {
    propsIndex = JSON.parse(fs.readFileSync(propsIndexPath, 'utf8'));
  }
} else {
  const fallback = buildProceduralWorldAssets();
  meta = fallback.meta;
  heights = fallback.heights;
  propsIndex = fallback.propsIndex;
}

const engine = new Gujian2EngineCore(meta, heights, propsIndex, { seed, mode });

const rl = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  if (trimmed === 'quit' || trimmed === 'exit') {
    process.exit(0);
  }
  try {
    const payload = JSON.parse(trimmed);
    const res = engine.dispatch(payload);
    process.stdout.write(JSON.stringify(res) + '\n');
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: String((err && err.message) || err),
      }) + '\n',
    );
  }
});
