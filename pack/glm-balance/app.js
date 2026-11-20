// GLM 余额：Web Crypto 现签 JWT -> zebar.shellExec 调系统 curl -> 解析余额
import * as zebar from 'https://esm.sh/zebar@3';

const cfg = window.CONFIG || {};
const CURL = 'C:\\Windows\\System32\\curl.exe';
const BALANCE_URL = 'https://open.bigmodel.cn/api/paas/v4/users/balance_info';

const $ = (id) => document.getElementById(id);

// ---------- JWT HS256 自签（智谱 Key 格式 "{id}.{secret}"） ----------
function b64url(buf) {
  let bin = '';
  for (const byte of new Uint8Array(buf)) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(apiKey) {
  const dot = apiKey.indexOf('.');
  const id = apiKey.slice(0, dot);
  const secret = apiKey.slice(dot + 1);
  const now = Math.floor(Date.now() / 1000);

  const enc = (obj) =>
    b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const header = enc({ alg: 'HS256', sign_type: 'SIGN' });
  const payload = enc({ api_key: id, exp: now + 1800, timestamp: now });

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = b64url(
    await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${header}.${payload}`),
    ),
  );
  return `${header}.${payload}.${sig}`;
}

// ---------- 刷新调度：成功 30min，失败退避 1/5/15min ----------
const BACKOFF = [1, 5, 15];
let failCount = 0;
let timer = null;

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(refresh, ms);
}

function hhmm() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function refresh() {
  if (!cfg.GLM_KEY) {
    $('balance').textContent = '--';
    $('meta').textContent = '未配置：请在 pack/config.js 填 GLM_KEY';
    schedule(60 * 1000);
    return;
  }

  try {
    const token = await signJwt(cfg.GLM_KEY);
    const out = await zebar.shellExec(CURL, [
      '-s', '-m', '15',
      '-H', `Authorization: Bearer ${token}`,
      BALANCE_URL,
    ]);

    let json;
    try {
      json = JSON.parse(out.stdout);
    } catch {
      throw new Error(out.stderr?.slice(0, 80) || '响应不是 JSON');
    }

    // 响应结构做防御式解析
    const info = json.balanceInfo ?? json.data?.balanceInfo ?? json;
    const balance = info.totalBalance ?? info.total_balance;
    if (balance === undefined) throw new Error('未找到余额字段');

    const unit = info.measureUnit === 'tokens' ? ' tokens' : ' 元';
    $('balance').innerHTML =
      `${Number(balance).toFixed(2)}<span class="unit">${unit}</span>`;
    $('meta').textContent = `刷新于 ${hhmm()} · 点击手动刷新`;

    failCount = 0;
    schedule(30 * 60 * 1000);
  } catch (err) {
    failCount++;
    const wait = BACKOFF[Math.min(failCount, BACKOFF.length) - 1];
    $('meta').textContent =
      `请求失败(${String(err).slice(0, 60)}) · ${wait}min 后重试`;
    schedule(wait * 60 * 1000);
  }
}

$('card').addEventListener('click', () => {
  clearTimeout(timer);
  $('meta').textContent = '刷新中…';
  refresh();
});

refresh();
