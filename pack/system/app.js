// 本机状态：zebar 内置 provider（cpu / memory / network / host），自动推送更新
// zebar 客户端 API 来自本地打包（shared/zebar.bundle.js），无外网依赖
const zebar = window.ZEBAR;

const providers = zebar.createProviderGroup({
  host: { type: 'host' },
  cpu: { type: 'cpu', refreshInterval: 2000 },
  memory: { type: 'memory', refreshInterval: 3000 },
  network: { type: 'network', refreshInterval: 2000 },
});

const $ = (id) => document.getElementById(id);

function barColor(pct) {
  return pct >= 90 ? 'err' : pct >= 75 ? 'warn' : '';
}

function setBar(barId, pctId, pct) {
  if (typeof pct !== 'number' || isNaN(pct)) return;
  $(barId).style.width = `${Math.min(pct, 100)}%`;
  $(barId).className = barColor(pct);
  $(pctId).textContent = `${Math.round(pct)}%`;
}

function fmtGB(bytes) {
  return (bytes / 1024 ** 3).toFixed(1);
}

function render(output) {
  if (output.host?.hostname) {
    document.querySelector('.title').childNodes[0].textContent =
      `本机 · ${output.host.hostname}`;
  }

  if (typeof output.cpu?.usage === 'number') {
    setBar('cpu-bar', 'cpu-pct', output.cpu.usage);
  }

  if (typeof output.memory?.usage === 'number') {
    setBar('mem-bar', 'mem-pct', output.memory.usage);
  }

  const m = output.memory;
  if (m && m.totalMemory) {
    $('meta').textContent = `内存 ${fmtGB(m.usedMemory)} / ${fmtGB(m.totalMemory)} GB`;
  }

  const t = output.network?.traffic;
  if (t) {
    const up = t.transmitted?.siValue ?? 0;
    const upUnit = t.transmitted?.siUnit ?? 'B';
    const down = t.received?.siValue ?? 0;
    const downUnit = t.received?.siUnit ?? 'B';
    $('net').innerHTML =
      `<span class="up">↑ ${up.toFixed(1)} ${upUnit}/s</span>` +
      ` <span class="down">↓ ${down.toFixed(1)} ${downUnit}/s</span>`;
  }
}

providers.onOutput(render);
