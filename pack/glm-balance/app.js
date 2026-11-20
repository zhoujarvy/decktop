// GLM Code Plan 用量进度条 + 余额：
//  - GET /api/monitor/usage/quota/limit                  额度池（TOKENS_LIMIT = Code Plan 窗口）
//  - GET /api/biz/account/query-customer-account-report  余额（小字）
import * as zebar from 'https://esm.sh/zebar@3';

let cfg = window.DW ? window.DW.config() : (window.CONFIG || {});
const CURL = 'C:\\Windows\\System32\\curl.exe';
const BASE = 'https://open.bigmodel.cn';

const $ = (id) => document.getElementById(id);

const BACKOFF = [1, 5, 15];
let failCount = 0;
let timer = null;
let countdownTimer = null;

// 进度条对应的额度池状态
const pool = { label: null, usedPct: null, remainingText: null, nextReset: null };

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(refresh, ms);
}

function hhmm(ts) {
  const d = ts ? new Date(ts) : new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function api(path) {
  const out = await zebar.shellExec(CURL, [
    '-s', '-m', '15',
    '-H', `Authorization: Bearer ${cfg.GLM_KEY}`,
    `${BASE}${path}`,
  ]);
  if (out.code !== 0) throw new Error(`curl exit ${out.code}`);
  const json = JSON.parse(out.stdout);
  if (!json.success && json.code !== 200) {
    throw new Error(json.msg || `code ${json.code}`);
  }
  return json.data;
}

// 额度池单位：1=天 3=小时 5=月 6=周
const UNIT = { 1: '天', 3: '小时', 5: '月', 6: '周' };

function barColor(pct) {
  return pct >= 90 ? 'err' : pct >= 75 ? 'warn' : '';
}

function renderBar() {
  if (pool.usedPct === null) {
    $('usage-bar').style.width = '0';
    $('usage-bar').className = '';
    $('usage-pct').textContent = '--%';
    return;
  }
  $('usage-bar').style.width = `${Math.min(pool.usedPct, 100)}%`;
  $('usage-bar').className = barColor(pool.usedPct);
  $('usage-pct').textContent = `${Math.round(pool.usedPct)}%`;
  $('usage-pct').className = `pct ${barColor(pool.usedPct)}`.trim();
}

function renderMeta() {
  const parts = [];
  if (pool.label) parts.push(pool.label);
  if (pool.remainingText) parts.push(pool.remainingText);
  if (pool.nextReset) {
    const left = pool.nextReset - Date.now();
    if (left > 0) {
      const mins = Math.round(left / 60000);
      parts.push(mins >= 60
        ? `${Math.floor(mins / 60)}时${mins % 60}分后重置（${hhmm(pool.nextReset)}）`
        : `${mins}分后重置（${hhmm(pool.nextReset)}）`);
    } else {
      parts.push(`${hhmm(pool.nextReset)} 重置`);
    }
  }
  if (parts.length) $('meta').textContent = parts.join(' · ');
}

function pickPool(limits) {
  const list = Array.isArray(limits) ? limits : [];
  const p = list.find((l) => l.type === 'TOKENS_LIMIT') ??
    list.find((l) => l.type === 'TIME_LIMIT');
  pool.label = null;
  pool.usedPct = null;
  pool.remainingText = null;
  pool.nextReset = null;
  if (!p) return;

  pool.label = `${p.number}${UNIT[p.unit] ?? ''}窗口`;
  if (typeof p.percentage === 'number') {
    pool.usedPct = p.percentage;
  }
  if (typeof p.remaining === 'number' && typeof p.usage === 'number') {
    pool.remainingText = `剩 ${p.remaining}/${p.usage}`;
  } else if (Array.isArray(p.usageDetails) && p.usageDetails.length) {
    pool.remainingText = null; // 明细太长，进度条已够直观
  }
  if (typeof p.nextResetTime === 'number' && p.nextResetTime > 1e12) {
    pool.nextReset = p.nextResetTime;
  }
}

async function refresh() {
  if (!cfg.GLM_KEY) {
    $('meta').textContent = '未配置：请在 pack/config.js 填 GLM_KEY';
    schedule(60 * 1000);
    return;
  }

  try {
    const [quota, account] = await Promise.all([
      api('/api/monitor/usage/quota/limit'),
      api('/api/biz/account/query-customer-account-report').catch(() => null),
    ]);

    pickPool(quota?.limits);
    renderBar();
    renderMeta();

    if (account) {
      const avail = Number(account.availableBalance ?? account.balance ?? 0);
      $('balance').textContent = `余额 ¥${avail.toFixed(2)}`;
    }

    failCount = 0;
    schedule(10 * 60 * 1000);
  } catch (err) {
    failCount++;
    const wait = BACKOFF[Math.min(failCount, BACKOFF.length) - 1];
    $('meta').textContent =
      `请求失败(${String(err.message ?? err).slice(0, 60)}) · ${wait}min 后重试`;
    schedule(wait * 60 * 1000);
  }
}

$('card').addEventListener('click', () => {
  clearTimeout(timer);
  $('meta').textContent = '刷新中…';
  refresh();
});

refresh();
// 不重新拉数据，仅根据已存的 nextReset 每分钟刷新倒计时文字
countdownTimer = setInterval(renderMeta, 60 * 1000);

// 设置面板换 Key 后热更新
window.addEventListener('dw-config', (e) => {
  const newKey = e.detail.GLM_KEY;
  if (newKey !== cfg.GLM_KEY) {
    cfg = e.detail;
    failCount = 0;
    clearTimeout(timer);
    $('meta').textContent = '刷新中…';
    refresh();
  } else {
    cfg = e.detail;
  }
});
