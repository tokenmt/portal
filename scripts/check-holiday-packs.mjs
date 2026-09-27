#!/usr/bin/env node
// 校验 portal/public/holidays/ 下的节假日数据包是否符合 backend schema
// （backend/crates/server/src/services/holiday_packs.rs 的 parse_country_pack / parse_manifest）。
// 用法：node scripts/check-holiday-packs.mjs
// 退出码 0 = 全部通过；非 0 = 有失败（fail-loud）。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'public', 'holidays');
const MAX_PACK_BYTES = 256 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_YEARS_PER_COUNTRY = 50;
const TYPES = new Set(['holiday', 'workday']);
const CC_RE = /^[A-Z]{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

function readJson(file) {
  const raw = readFileSync(join(DIR, file));
  return { raw, json: JSON.parse(raw.toString('utf8')) };
}

// ── manifest.json ──
if (!existsSync(join(DIR, 'manifest.json'))) {
  fail('manifest.json', 'missing');
}
const manifest = readJson('manifest.json');
if (manifest.raw.length > MAX_MANIFEST_BYTES) fail('manifest.json', `exceeds ${MAX_MANIFEST_BYTES} bytes`);
if (manifest.json.schema_version > 1) fail('manifest.json', `schema_version ${manifest.json.schema_version} > 1`);
const seenCC = new Set();
for (const c of manifest.json.countries) {
  if (!CC_RE.test(c.country_code)) fail('manifest.json', `invalid country_code '${c.country_code}'`);
  if (seenCC.has(c.country_code)) fail('manifest.json', `duplicate country_code '${c.country_code}'`);
  seenCC.add(c.country_code);
  if (!SEMVER_RE.test(c.version)) fail('manifest.json', `version '${c.version}' not semver`);
}

// ── 每个 <CC>.json ──
const packFiles = readdirSync(DIR).filter((f) => /^[A-Z]{2}\.json$/.test(f));
for (const file of packFiles) {
  const cc = file.replace('.json', '');
  const { raw, json: p } = readJson(file);
  if (raw.length > MAX_PACK_BYTES) fail(file, `exceeds ${MAX_PACK_BYTES} bytes`);
  if (p.schema_version > 1) fail(file, `schema_version ${p.schema_version} > 1`);
  if (!CC_RE.test(p.country_code)) fail(file, `invalid country_code '${p.country_code}'`);
  if (p.country_code !== cc) fail(file, `country_code '${p.country_code}' != filename '${cc}'`);
  if (!SEMVER_RE.test(p.version)) fail(file, `version '${p.version}' not semver`);
  const mEntry = manifest.json.countries.find((c) => c.country_code === cc);
  if (!mEntry) fail(file, `not listed in manifest.json`);
  else if (mEntry.version !== p.version) fail(file, `version '${p.version}' != manifest '${mEntry.version}'`);
  if (p.years.length > MAX_YEARS_PER_COUNTRY) fail(file, `years ${p.years.length} > ${MAX_YEARS_PER_COUNTRY}`);

  const seenYears = new Set();
  for (const y of p.years) {
    if (!Number.isInteger(y.year) || y.year < -32768 || y.year > 32767) fail(file, `year ${y.year} out of i16 range`);
    if (seenYears.has(y.year)) fail(file, `duplicate year ${y.year}`);
    seenYears.add(y.year);
    const seenDates = new Set();
    for (const e of y.entries) {
      if (!DATE_RE.test(e.date)) fail(file, `bad date '${e.date}'`);
      else if (Number(e.date.slice(0, 4)) !== y.year) fail(file, `date '${e.date}' year != ${y.year}`);
      if (typeof e.name !== 'string' || e.name.length === 0) fail(file, `empty name at ${e.date}`);
      if (!TYPES.has(e.type)) fail(file, `bad type '${e.type}' at ${e.date}`);
      if (seenDates.has(e.date)) fail(file, `duplicate date ${e.date}`);
      seenDates.add(e.date);
    }
  }
}

// ── 每个 manifest 国家必须有对应包 ──
for (const c of manifest.json.countries) {
  if (!packFiles.includes(`${c.country_code}.json`)) fail('manifest.json', `${c.country_code} listed but ${c.country_code}.json missing`);
}

// ── 报告 ──
if (errors.length) {
  console.error(`check-holiday-packs: ${errors.length} failure(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`check-holiday-packs: OK (${packFiles.length} packs: ${packFiles.map((f) => f.replace('.json', '')).join(', ')})`);
