// NAS 状态：zebar.shellExec 调 curl 轮询 FNOS-API（已实测的响应结构）
//  /api/monitor/cpu            -> data.cpu.busy.all (%)
//  /api/monitor/memory         -> data.mem.total/used (bytes)
//  /api/storage/overview       -> data.array[] {mountpoint, fssize(总), frsize(空闲)}
//  /api/docker/container/ls    -> data[] {Names[], State, Status}
import * as zebar from 'https://esm.sh/zebar@3';

const cfg = window.CONFIG || {};
const CURL = 'C:\\Windows\\System32\\curl.exe';
const BASE = `http://${cfg.NAS_HOST || '192.168.0.100'}:9932`;

const $ = (id) => document.getElementById(id);

const state = {
  online: false,
  everOnline: false,
  cpu: null,
  mem: null,
  storage: [],
  containers: [],
  offlineSince: null,
  lastRefresh: null,
  authError: false,
};

async function api(path, timeoutSec = 5) {
  const out = await zebar.shellExec(CURL, [
    '-s', '-m', String(timeoutSec),
    '-H', `Authorization: Bearer ${cfg.FNOS_TOKEN || 'none'}`,
    `${BASE}${path}`,
  ]);
  if (out.code !== 0) throw new Error(`curl exit ${out.code}`);
  let json;
  try {
    json = JSON.parse(out.stdout);
  } catch {
    throw new Error('响应不是 JSON');
  }
  if (json.success === false) {
    const err = new Error(json.error || json.msg || '接口返回失败');
    if (/令牌/.test(json.error ?? '')) err.authError = true;
    throw err;
  }
  return json.data;
}

function fmtBytes(bytes) {
  if (typeof bytes !== 'number' || !isFinite(bytes)) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(bytes >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function hhmmss() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0')).join(':');
}

// ---------- 渲染 ----------
function setDot(cls) {
  $('dot').className = `dot ${cls}`.trim();
}

function barColor(pct) {
  return pct >= 90 ? 'err' : pct >= 75 ? 'warn' : '';
}

function setBar(barId, pctId, pct) {
  if (pct === null || pct === undefined || isNaN(pct)) {
    $(barId).style.width = '0';
    $(pctId).textContent = '--';
    return;
  }
  $(barId).style.width = `${Math.min(pct, 100)}%`;
  $(barId).className = barColor(pct);
  $(pctId).textContent = `${Math.round(pct)}%`;
}

function showGuide(html) {
  $('body').style.display = 'none';
  $('guide').style.display = 'block';
  $('guide').innerHTML = html;
}

function render() {
  const card = $('card');

  if (!cfg.FNOS_TOKEN && !state.everOnline) {
    showGuide('未配置：请在 <b>pack/config.js</b> 填入 FNOS_TOKEN。');
    setDot('off');
    $('status').textContent = '未配置';
    return;
  }

  $('guide').style.display = 'none';
  $('body').style.display = 'block';

  if (!state.online) {
    card.classList.add('degraded');
    setDot('off');
    $('status').textContent = '离线';
    $('meta').textContent = `自 ${state.offlineSince ?? '--'} 失联 · 30s 探活中`;
    return;
  }

  card.classList.remove('degraded');
  setDot('');
  $('status').textContent = '在线';

  setBar('cpu-bar', 'cpu-pct', state.cpu);
  setBar('mem-bar', 'mem-pct', state.mem);

  $('storage').innerHTML = state.storage
    .map((s) => `<div class="row" style="margin-top:2px">
      <span class="storage-name">${s.name}</span>
      <div class="bar"><div class="${barColor(s.pct) ?? ''}" style="width:${Math.min(s.pct, 100)}%"></div></div>
      <span class="storage-size">${s.usedText}/${s.totalText}</span>
    </div>`)
    .join('');

  $('services').innerHTML = state.containers.length
    ? state.containers.map((c) =>
        `<span class="svc"><span class="dot ${c.ok ? '' : 'err'}"></span>${c.name}</span>`)
        .join('')
    : '';

  $('meta').textContent = `刷新于 ${state.lastRefresh ?? '--'}`;
}

// ---------- 轮询 ----------
let probing = false;

async function pollFast() {
  if (probing) return;
  probing = true;
  try {
    const [cpu, mem] = await Promise.all([
      api('/api/monitor/cpu'),
      api('/api/monitor/memory'),
    ]);
    state.cpu = cpu?.cpu?.busy?.all ?? null;
    const m = mem?.mem;
    state.mem = m && m.total > 0 ? (m.used / m.total) * 100 : null;
    state.lastRefresh = hhmmss();
    state.online = true;
    state.everOnline = true;
    state.offlineSince = null;
  } catch (err) {
    if (err.authError) {
      state.online = true;
      state.everOnline = true;
      showGuide('鉴权失败：请检查 config.js 的 FNOS_TOKEN 是否与 NAS 上' +
        ' FNOS-API 配置（/vol2/@appdata/fnos-api-gw/data/config.json 的 api_token）一致。');
      setDot('warn');
      $('status').textContent = '配置异常';
    } else {
      state.online = false;
      state.offlineSince = state.offlineSince ?? hhmmss();
    }
  } finally {
    probing = false;
    render();
  }
}

async function pollSlow() {
  if (!state.online || state.authError) return;
  try {
    const overview = await api('/api/storage/overview', 8);
    const vols = overview?.array ?? [];
    state.storage = vols.slice(0, 3).map((v) => {
      const total = v.fssize ?? 0;
      const free = v.frsize ?? 0;
      return {
        name: v.mountpoint ?? '卷',
        pct: total > 0 ? ((total - free) / total) * 100 : 0,
        usedText: fmtBytes(total - free),
        totalText: fmtBytes(total),
      };
    });

    const list = (await api('/api/docker/container/ls', 8)) ?? [];
    const watch = (cfg.WATCH_CONTAINERS || []).map((s) => s.toLowerCase());
    let filtered = list;
    if (watch.length) {
      filtered = list.filter((c) => {
        const name = (c.Names?.[0] ?? '').toString().toLowerCase();
        return watch.some((w) => name.includes(w));
      });
    }
    state.containers = filtered.slice(0, 12).map((c) => ({
      name: (c.Names?.[0] ?? c.Id?.slice(0, 8) ?? '?').toString().replace(/^\//, ''),
      ok: c.State === 'running',
    }));
    render();
  } catch { /* 静默，下一轮 */ }
}

// 在线时 10s 轮询 CPU/内存；离线时改为 30s 探活
setInterval(() => pollFast(), state.online ? 10 * 1000 : 30 * 1000);
setInterval(pollSlow, 60 * 1000);
pollFast().then(() => {
  if (state.online) pollSlow();
});
