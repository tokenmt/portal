#!/usr/bin/env node
// THUB-583: 对 public/holidays 与 public/llm-presets 的数据包文件产出 Ed25519 签名
//（<file>.sig = 原始 64 字节，wire 形态对齐 backend signed_pack.rs fetch_signed_bytes）。
// 私钥：secrets/pack-signing.key.hex（hex 编码 32 字节 seed，gitignored，勿入库）。
// 用法：node scripts/sign-data-packs.mjs [--key <path>] [file...]
//   无 file 参数 = 重签两目录下全部 manifest.json / *.json 数据包。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let keyPath;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--key') keyPath = args[++i];
  else files.push(args[i]);
}
if (!keyPath) {
  // 默认：portal 同级主仓 secrets/（sibling 布局）；可用 --key 覆盖
  keyPath = resolve(ROOT, '..', '..', 'secrets', 'pack-signing.key.hex');
}
if (!existsSync(keyPath)) {
  console.error(`sign-data-packs: signing key not found: ${keyPath}（--key 指定或放 secrets/pack-signing.key.hex）`);
  process.exit(1);
}
const seed = Buffer.from(readFileSync(keyPath, 'utf8').trim(), 'hex');
if (seed.length !== 32) {
  console.error(`sign-data-packs: key must be 32-byte hex seed, got ${seed.length} bytes`);
  process.exit(1);
}
// raw seed → PKCS8 DER（Ed25519 RFC 8410 前缀）
const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
const priv = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });

const targets = [];
if (files.length) {
  targets.push(...files.map((f) => resolve(process.cwd(), f)));
} else {
  for (const dir of ['holidays', 'llm-presets']) {
    const d = join(ROOT, 'public', dir);
    if (!existsSync(d)) continue;
    targets.push(join(d, 'manifest.json'));
    targets.push(...readdirSync(d).filter((f) => /^[A-Za-z-]+\.json$/.test(f) && f !== 'manifest.json').map((f) => join(d, f)));
  }
}
for (const file of targets) {
  const msg = readFileSync(file);
  const sig = crypto.sign(null, msg, priv); // 64 字节原始签名
  writeFileSync(`${file}.sig`, sig);
  console.log(`sign-data-packs: ${file} -> ${file}.sig (${sig.length} bytes)`);
}
