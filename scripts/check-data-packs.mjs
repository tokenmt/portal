#!/usr/bin/env node
// THUB-583: 校验 public/holidays 与 public/llm-presets 两类签名数据包是否符合 backend schema
//（backend crates/server/src/services/data_packs/{holidays,llm_presets}.rs 的解析规则）。
// 取代 check-holiday-packs.mjs（issue#228）。用法：node scripts/check-data-packs.mjs
// 退出码 0 = 全部通过；非 0 = 有失败（fail-loud）。
// 注意：本脚本只校验 portal 内两类包（独立仓不读 backend 文件）；内嵌快照一致性
// 由 backend 侧 schema 测试承接。
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_YEARS_PER_COUNTRY = 50;
const TYPES = new Set(['holiday', 'workday']);
const CC_RE = /^[A-Z]{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const SLOT_KEYS = new Set(['anthropic', 'openai', 'gemini', 'seedance', 'minimax']);

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

function load(dir, file) {
  const raw = readFileSync(join(ROOT, 'public', dir, file));
  return { raw, json: JSON.parse(raw.toString('utf8')) };
}

// ── holidays（issue#228 语义平移）──
{
  const DIR = 'holidays';
  if (!existsSync(join(ROOT, 'public', DIR, 'manifest.json'))) {
    fail(`${DIR}/manifest.json`, 'missing');
  } else {
    const manifest = load(DIR, 'manifest.json');
    if (manifest.raw.length > MAX_MANIFEST_BYTES) fail(`${DIR}/manifest.json`, `exceeds ${MAX_MANIFEST_BYTES} bytes`);
    if (manifest.json.schema_version > 1) fail(`${DIR}/manifest.json`, `schema_version ${manifest.json.schema_version} > 1`);
    const seenCC = new Set();
    for (const c of manifest.json.countries) {
      if (!CC_RE.test(c.country_code)) fail(`${DIR}/manifest.json`, `invalid country_code '${c.country_code}'`);
      if (seenCC.has(c.country_code)) fail(`${DIR}/manifest.json`, `duplicate country_code '${c.country_code}'`);
      seenCC.add(c.country_code);
      if (!SEMVER_RE.test(c.version)) fail(`${DIR}/manifest.json`, `version '${c.version}' not semver`);
    }
    const packFiles = readdirSync(join(ROOT, 'public', DIR)).filter((f) => /^[A-Z]{2}\.json$/.test(f));
    for (const file of packFiles) {
      const cc = file.replace('.json', '');
      const { raw, json: p } = load(DIR, file);
      if (raw.length > MAX_PAYLOAD_BYTES) fail(`${DIR}/${file}`, `exceeds ${MAX_PAYLOAD_BYTES} bytes`);
      if (p.schema_version > 1) fail(`${DIR}/${file}`, `schema_version ${p.schema_version} > 1`);
      if (!CC_RE.test(p.country_code)) fail(`${DIR}/${file}`, `invalid country_code '${p.country_code}'`);
      if (p.country_code !== cc) fail(`${DIR}/${file}`, `country_code '${p.country_code}' != filename '${cc}'`);
      if (!SEMVER_RE.test(p.version)) fail(`${DIR}/${file}`, `version '${p.version}' not semver`);
      const mEntry = manifest.json.countries.find((c) => c.country_code === cc);
      if (!mEntry) fail(`${DIR}/${file}`, `not listed in manifest.json`);
      else if (mEntry.version !== p.version) fail(`${DIR}/${file}`, `version '${p.version}' != manifest '${mEntry.version}'`);
      if (p.years.length > MAX_YEARS_PER_COUNTRY) fail(`${DIR}/${file}`, `years ${p.years.length} > ${MAX_YEARS_PER_COUNTRY}`);

      const seenYears = new Set();
      for (const y of p.years) {
        if (!Number.isInteger(y.year) || y.year < -32768 || y.year > 32767) fail(`${DIR}/${file}`, `year ${y.year} out of i16 range`);
        if (seenYears.has(y.year)) fail(`${DIR}/${file}`, `duplicate year ${y.year}`);
        seenYears.add(y.year);
        const seenDates = new Set();
        for (const e of y.entries) {
          if (!DATE_RE.test(e.date)) fail(`${DIR}/${file}`, `bad date '${e.date}'`);
          else if (Number(e.date.slice(0, 4)) !== y.year) fail(`${DIR}/${file}`, `date '${e.date}' year != ${y.year}`);
          if (typeof e.name !== 'string' || e.name.length === 0) fail(`${DIR}/${file}`, `empty name at ${e.date}`);
          if (!TYPES.has(e.type)) fail(`${DIR}/${file}`, `bad type '${e.type}' at ${e.date}`);
          if (seenDates.has(e.date)) fail(`${DIR}/${file}`, `duplicate date ${e.date}`);
          seenDates.add(e.date);
        }
      }
    }
    for (const c of manifest.json.countries) {
      if (!packFiles.includes(`${c.country_code}.json`)) fail(`${DIR}/manifest.json`, `${c.country_code} listed but ${c.country_code}.json missing`);
    }
    // sig 检查
    for (const f of ['manifest.json', ...packFiles]) {
      const sig = join(ROOT, 'public', DIR, `${f}.sig`);
      if (!existsSync(sig)) fail(`${DIR}/${f}.sig`, 'missing (backend requests <file>.sig; 404 aborts fetch)');
      else if (statSync(sig).size !== 64) fail(`${DIR}/${f}.sig`, `must be 64 raw bytes, got ${statSync(sig).size}`);
    }
    if (!errors.some((e) => e.startsWith('holidays/'))) {
      console.log(`check-data-packs: holidays OK (${packFiles.map((f) => f.replace('.json', '')).join(', ')})`);
    }
  }
}

// ── llm-presets（THUB-583 D2/D9：单份清单，忽略未知字段，仅拒未知 schema_version）──
{
  const DIR = 'llm-presets';
  const dir = join(ROOT, 'public', DIR);
  if (!existsSync(join(dir, 'manifest.json'))) {
    fail(`${DIR}/manifest.json`, 'missing');
  } else {
    const manifest = load(DIR, 'manifest.json');
    if (manifest.raw.length > MAX_MANIFEST_BYTES) fail(`${DIR}/manifest.json`, `exceeds ${MAX_MANIFEST_BYTES} bytes`);
    if (manifest.json.schema_version > 1) fail(`${DIR}/manifest.json`, `schema_version ${manifest.json.schema_version} > 1`);
    if (!SEMVER_RE.test(manifest.json.version)) fail(`${DIR}/manifest.json`, `version '${manifest.json.version}' not semver`);

    const presets = load(DIR, 'presets.json');
    if (presets.raw.length > MAX_PAYLOAD_BYTES) fail(`${DIR}/presets.json`, `exceeds ${MAX_PAYLOAD_BYTES} bytes`);
    if (presets.json.schema_version > 1) fail(`${DIR}/presets.json`, `schema_version ${presets.json.schema_version} > 1`);
    const seenIds = new Set();
    for (const p of presets.json.presets ?? []) {
      if (typeof p.id !== 'string' || p.id.trim().length === 0) fail(`${DIR}/presets.json`, `empty preset id`);
      else if (seenIds.has(p.id)) fail(`${DIR}/presets.json`, `duplicate preset id '${p.id}'`);
      seenIds.add(p.id);
      const zh = p.label?.zh ?? '';
      const en = p.label?.en ?? '';
      if (zh.trim().length === 0 && en.trim().length === 0) fail(`${DIR}/presets.json`, `preset '${p.id}' label empty (zh and en)`);
      for (const [k, v] of Object.entries(p.slots ?? {})) {
        if (!SLOT_KEYS.has(k)) continue; // D9：未知槽位忽略（旧 backend 兼容演进）
        if (typeof v !== 'string' || !/^https?:\/\//.test(v)) fail(`${DIR}/presets.json`, `preset '${p.id}' slot '${k}' must be http(s) URL, got '${v}'`);
      }
    }
    for (const f of ['manifest.json', 'presets.json']) {
      const sig = join(dir, `${f}.sig`);
      if (!existsSync(sig)) fail(`${DIR}/${f}.sig`, 'missing (backend requests <file>.sig; 404 aborts fetch)');
      else if (statSync(sig).size !== 64) fail(`${DIR}/${f}.sig`, `must be 64 raw bytes, got ${statSync(sig).size}`);
    }
    if (!errors.some((e) => e.startsWith('llm-presets/'))) {
      console.log(`check-data-packs: llm-presets OK (${seenIds.size} presets)`);
    }
  }
}

// ── 报告 ──
if (errors.length) {
  console.error(`check-data-packs: ${errors.length} failure(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('check-data-packs: all OK');
