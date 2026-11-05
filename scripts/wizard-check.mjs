#!/usr/bin/env node
// issue#659 配套：BYOK 向导 pack selector 校验台（本机调试，免盒子真机）。
//
// 用法：
//   node scripts/wizard-check.mjs <pack.json> [选项]
// 选项：
//   --vendor <id>     校验指定 vendor（默认第一个）
//   --url <url>       覆盖 entry_url（调试中途页面用）
//   --headed/--headless  默认 headed（登录需要人工）
//   --cdp-rs <path>   backend cdp.rs 路径（默认 ../backend/.../cdp.rs），
//                     从中提取 OVERLAY_JS 真实注入脚本——单一事实源
//   --keep            结束后不关浏览器（人工检查）
//
// 流程：打开 entry_url → 等待人工登录（stdin 回车继续）→ 注入真实字幕/描边
// → 逐步骤报告命中/文本门/推断当前步骤 → 提取 selectors 试探 → 截图。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { chromium } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function join(...a) { return resolve(...a); }

const args = process.argv.slice(2);
const opt = { vendor: null, url: null, headless: false, cdp: join(ROOT, '..', 'backend', 'crates', 'server', 'src', 'services', 'byok_wizard', 'cdp.rs'), keep: false };
const packPath = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--vendor') opt.vendor = args[++i];
  else if (args[i] === '--url') opt.url = args[++i];
  else if (args[i] === '--headless') opt.headless = true;
  else if (args[i] === '--headed') opt.headless = false;
  else if (args[i] === '--cdp-rs') opt.cdp = args[++i];
  else if (args[i] === '--keep') opt.keep = true;
  else packPath.push(args[i]);
}
if (!packPath.length) { console.error('用法: wizard-check.mjs <pack.json> [--vendor id] [--url u] [--headless] [--keep]'); process.exit(1); }

const pack = JSON.parse(readFileSync(resolve(process.cwd(), packPath[0]), 'utf8'));
const vendor = opt.vendor ? pack.vendors.find((v) => v.id === opt.vendor) : pack.vendors[0];
if (!vendor) { console.error(`vendor '${opt.vendor}' 不存在`); process.exit(1); }

// 从 backend cdp.rs 提取 OVERLAY_JS（与线上一字不差）
const rs = readFileSync(opt.cdp, 'utf8');
// issue#680：正则对齐 cdp.rs r## 定界符（issue#662 D7 引入 r## 后本台静默坏掉）；
// params 补 keys/url 与 backend build_overlay_expression 形状对齐（OVERLAY_JS 据此 arm）。
const m = rs.match(/const OVERLAY_JS: &str = r##"([\s\S]*?)"##;/);
if (!m) { console.error('未能从 cdp.rs 提取 OVERLAY_JS'); process.exit(1); }
const overlayJs = m[1];
const normMatch = (m) => (Array.isArray(m) ? m : m ? [m] : []);
const steps = vendor.steps.map((s) => ({ text: s.text.zh_CN, highlight: s.highlight_selector, match: s.match_text ? normMatch(s.match_text) : [], url: s.url_includes }));
const params = JSON.stringify({ steps, keys: vendor.selectors, remove: false });
const injectExpr = overlayJs.replace('__PARAMS__', params);
// probe 表达式（backend build_probe_expression 同款）
const selArr = vendor.selectors.map((s) => JSON.stringify(s)).join(',');
const probeExpr = `(() => { for (const s of [${selArr}]) { const el = document.querySelector(s); if (el) { const t = (el.textContent || el.value || '').trim(); if (t) return t; } } return null; })()`;

const rl = createInterface({ input: process.stdin });
// 非 TTY（管道/自动化）直接跳过人工登录等待
const waitEnter = (msg) =>
  process.stdin.isTTY ? new Promise((res) => { console.log(msg); rl.once('line', res); }) : Promise.resolve();

const browser = await chromium.launch({ headless: opt.headless });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(opt.url ?? vendor.entry_url, { waitUntil: 'domcontentloaded' });
await waitEnter('如需登录/过验证码，请在浏览器窗口完成后按回车继续…');
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1500);

// 注入真实 overlay（幂等，跑两次验证重注入）
await page.evaluate(injectExpr);
await page.evaluate(injectExpr);

// 逐步骤校验（与 backend JS 同判定：selector 命中 + match_text 存在 → 最后命中者胜）
const report = await page.evaluate(({ steps }) => {
  const stepReport = steps.map((s, i) => {
    const r = { step: i + 1, text: (s.text || '').slice(0, 40), highlight: s.highlight, hit: false, matchOk: null, count: 0, rect: null };
    if (!s.highlight) { r.note = '无 selector（纯文案步骤）'; return r; }
    const els = document.querySelectorAll(s.highlight);
    r.count = els.length;
    r.hit = els.length > 0;
    if (s.match && s.match.length && els.length) {
      const scope = els[0].closest('[role="dialog"],dialog,.ds-modal,.ds-banner') || document.body;
      const st = scope.textContent || '';
      r.matchOk = s.match.some((t) => st.includes(t)) ? 'pass' : `FAIL（容器内文本不含 [${s.match.join(', ')}]）`;
    }
    if (r.hit) { const b = els[0].getBoundingClientRect(); r.rect = `t=${Math.round(b.top)} l=${Math.round(b.left)} ${Math.round(b.width)}x${Math.round(b.height)}`; }
    return r;
  });
  let cur = -1;
  steps.forEach((s, i) => {
    if (!s.highlight) return;
    const el = document.querySelector(s.highlight);
    if (!el) return;
    if (s.match && s.match.length) {
      const scope = el.closest('[role="dialog"],dialog,.ds-modal,.ds-banner') || document.body;
      const st = scope.textContent || '';
      if (!s.match.some((t) => st.includes(t))) return;
    }
    cur = i;
  });
  const bar = document.getElementById('__thub_byok_bar');
  const hl = document.getElementById('__thub_byok_hl');
  return { url: location.href, curStep: cur >= 0 ? cur + 1 : 1, barText: bar ? bar.textContent : null, hlRendered: !!hl, steps: stepReport };
}, { steps });
// probe 表达式直接在页面上下文执行（playwright evaluate 接受字符串表达式）
const probeVal = await page.evaluate(probeExpr);
report.probeHit = probeVal ? { prefix: probeVal.slice(0, 8), len: probeVal.length } : null;

console.log('\n=== 校验报告 ===');
console.log(`页面: ${report.url}`);
console.log(`推断当前步骤: ${report.curStep}；字幕条: ${report.barText ? '已渲染 ✓' : '未渲染 ✗'}；描边: ${report.hlRendered ? '已渲染 ✓' : '未渲染'}`);
console.log(`提取 probe: ${report.probeHit ? `命中（${report.probeHit.prefix}… ${report.probeHit.len} 字符）` : '未命中 ✗'}`);
for (const s of report.steps) {
  const flag = s.highlight ? (s.hit ? '✓' : '✗') : '—';
  console.log(`  步骤${s.step} ${flag} ${s.highlight ?? s.note} 命中数=${s.count}${s.rect ? ' @' + s.rect : ''}${s.matchOk ? ' 文本门=' + s.matchOk : ''} 「${s.text}」`);
}
await page.screenshot({ path: join(ROOT, 'wizard-check.png'), fullPage: false });
console.log('\n截图: portal/wizard-check.png');
rl.close();
if (!opt.keep) await browser.close();
writeFileSync(join(ROOT, 'wizard-check-report.json'), JSON.stringify(report, null, 2));
