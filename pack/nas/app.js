// NAS 状态：zebar.shellExec 调 curl 轮询 FNOS-API（飞牛上安装后提供 :9932 REST）
// 注：FNOS-API 响应结构以实测为准，解析层做了防御式处理，装好后按真实字段收紧
import * as zebar from 'https://esm.sh/zebar@3';

const cfg = window.CONFIG || {};
const CURL = 'C:\\Windows\\System32\\curl.exe';
const BASE = `http://${cfg.NAS_HOST || '192.168.0.100'}:9932`;

const $ = (id) => document.getElementById(id);

const state = {
  online: false,
  cpu: null,
  mem: null,
  storage: [],
  containers: [],
  offlineSince: null,
  lastRefresh: null,
};

// ---------- curl 封装 ----------
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
  // HTTP 错误（无 -f 时 curl 仍 exit 0，靠 body 判断）
  const code = json.code ?? json.status ?? json.error_code;
  if (typeof code === 'number' && code >= 400) {
    const err = new Error(`HTTP ${code}`);
    err.httpCode = code;
    throw err;
  }
  return json;
}

// ---------- 防御式取值 ----------
const asArray = (v) =>
  Array.isArray(v) ? v : v?.data ?? v?.list ?? v?.result ?? v?.items ?? [];
const pick = (obj, pct = null, used = null, total = null) => {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of pct ?? ['percent', 'usagePercent', 'usage_percent', 'usedPercent', 'used_percent']) {
    if (typeof obj[key] === 'number') return obj[key];
  }
  const u = obj[used ?? 'used'] ?? obj['usedBytes'];
  const t = obj[total ?? 'total'] ?? obj['totalBytes'];
  if (typeof u === 'number' && typeof t === 'number' && t > 0) return (u / t) * 100;
  return null;
};

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

// ---------- 渲染 ----------
function setDot(cls) {
  $('dot').className = `dot ${cls}`.trim();
}

function barColor(pct) {
  return pct >= 90 ? 'err' : pct >= 75 ? 'warn' : '';
}

function setBar(barId, pctId, pct) {
  if (pct === null) {
    $(barId).style.width = '0';
    $(pctId).textContent = '--';
    return;
  }
  $(barId).style.width = `${Math.min(pct, 100)}%`;
  $(barId).className = barColor(pct);
  $(pctId).textContent = `${Math.round(pct)}%`;
}

function hhmmss() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0')).join(':');
}

function render() {
  const card = $('card');

  if (!cfg.FNOS_TOKEN && state.online === false && !state.everOnline) {
    $('body').style.display = 'none';
    $('guide').style.display = 'block';
    $('guide').innerHTML =
      '未配置：请在 <b>pack/config.js</b> 填入 FNOS_TOKEN。<br>' +
      'NAS 上需先安装 FNOS-API（<a href="https://github.com/heijiangangqin/FNOS-API">github.com/heijiangangqin/FNOS-API</a>，需 fnOS ≥ 1.2.0800）。';
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

  // 磁盘卷
  if (state.storage.length) {
    $('storage').innerHTML = state.storage
      .map((s, i) => {
        const pct = s.pct ?? null;
        return `<div class="row" style="margin-top:2px">
          <span class="storage-name">${s.name ?? '卷' + (i + 1)}</span>
          <div class="bar"><div class="${barColor(pct) ?? ''}" style="width:${pct === null ? 0 : Math.min(pct, 100)}%"></div></div>
          <span class="storage-size">${s.usedText}/${s.totalText}</span>
        </div>`;
      })
      .join('');
  }

  // 服务存活
  const svcs = state.containers;
  $('services').innerHTML = svcs.length
    ? svcs.map((c) =>
        `<span class="svc"><span class="dot ${c.ok ? '' : 'err'}"></span>${c.name}</span>`
      ).join('')
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
    state.cpu = pick(asArray(cpu)[0] ?? cpu) ?? pick(cpu);
    state.mem = pick(asArray(mem)[0] ?? mem) ?? pick(mem);
    state.lastRefresh = hhmmss();
    if (!state.online) {
      state.online = true;
      state.everOnline = true;
      state.offlineSince = null;
    }
  } catch (err) {
    if (err.httpCode === 401 || err.httpCode === 403 || err.httpCode === 404) {
      // 端口通但鉴权失败/接口不存在：多半是 FNOS-API 未安装或 Token 错
      state.online = true;
      state.everOnline = true;
      state.authError = true;
      $('body').style.display = 'none';
      $('guide').style.display = 'block';
      $('guide').innerHTML = err.httpCode === 404
        ? ':9932 有响应但接口不存在——FNOS-API 可能未安装，见 <a href="https://github.com/heijiangangqin/FNOS-API">github.com/heijiangangqin/FNOS-API</a>'
        : `鉴权失败（HTTP ${err.httpCode}）：请检查 config.js 的 FNOS_TOKEN`;
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
  if (!state.online) return;
  try {
    // 存储卷：候选端点探测（响应结构装好后按实测收紧）
    for (const path of ['/api/storage/overview', '/api/storage/pools']) {
      try {
        const data = await api(path, 8);
        const vols = asArray(data);
        if (vols.length) {
          state.storage = vols.slice(0, 3).map((v) => {
            const pct = pick(v, ['percent', 'usedPercent', 'used_percent', 'usagePercent'], 'used', 'total');
            return {
              pct,
              name: v.name ?? v.volume ?? v.mountPoint ?? v.path ?? '卷',
              usedText: fmtBytes(v.used ?? v.usedBytes),
              totalText: fmtBytes(v.total ?? v.totalBytes ?? v.size),
            };
          });
          break;
        }
      } catch { /* 试下一个端点 */ }
    }

    // Docker 容器存活
    for (const path of ['/api/docker/container/ls', '/api/docker/containers']) {
      try {
        const data = await api(path, 8);
        let list = asArray(data);
        if (list.length) {
          const watch = (cfg.WATCH_CONTAINERS || []).map((s) => s.toLowerCase());
          if (watch.length) {
            list = list.filter((c) => {
              const name = (c.name ?? c.Names?.[0] ?? '').toString().toLowerCase();
              return watch.some((w) => name.includes(w));
            });
          }
          state.containers = list.slice(0, 12).map((c) => {
            const running = (c.state ?? c.status ?? c.State ?? '').toString().toLowerCase();
            return {
              name: (c.name ?? c.Names?.[0] ?? c.id ?? '?').toString().replace(/^\//, ''),
              ok: /^(running|up|running\s)/.test(running) || running === 'running',
            };
          });
          break;
        }
      } catch { /* 试下一个端点 */ }
    }
    render();
  } catch { /* 静默，等下一轮 */ }
}

// ---------- 启动 ----------
setInterval(pollFast, 10 * 1000);
setInterval(pollSlow, 60 * 1000);
pollFast().then(() => {
  if (state.online) pollSlow();
});
