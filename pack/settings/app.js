// 设置面板：卡片开关 / 城市（geocoding 解析）/ GLM Key / NAS 配置
// 保存 -> localStorage(dw.config) -> 各卡片经 storage 事件/轮询热生效
import * as zebar from 'https://esm.sh/zebar@3';

const LS_KEY = 'dw.config';
const $ = (id) => document.getElementById(id);

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

// ---------- 初始化表单 ----------
function initForm() {
  const usr = readUser();
  const def = window.CONFIG || {};
  const cardsOn = usr.cards || {};

  const stackCards = (window.DW_CARDS || []).filter(
    (c) => c.stack !== false && !c.fixed,
  );
  $('toggles').innerHTML = stackCards
    .map(
      (c) =>
        `<label><input type="checkbox" data-card="${c.name}" ` +
        `${cardsOn[c.name] !== false ? 'checked' : ''}/>${c.title}</label>`,
    )
    .join('');

  $('city').value = usr.city || def.CITY || '';
  $('glm-key').value = usr.glmKey ?? def.GLM_KEY ?? '';
  $('nas-host').value = usr.nasHost || def.NAS_HOST || '';
  $('nas-token').value = usr.nasToken ?? def.FNOS_TOKEN ?? '';
  $('watch').value = (usr.watch || def.WATCH_CONTAINERS || []).join(',');
}

// ---------- 城市经纬度解析 ----------
async function resolveCity(city) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}` +
      `&count=1&language=zh&format=json`,
  );
  if (!res.ok) throw new Error(`geocoding HTTP ${res.status}`);
  const data = await res.json();
  if (!data.results || !data.results.length) {
    throw new Error(`找不到城市“${city}”`);
  }
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, name: r.name };
}

// ---------- 保存 ----------
async function save() {
  const btn = $('save');
  const status = $('status');
  btn.disabled = true;

  const before = readUser();

  try {
    const city = $('city').value.trim();
    let lat, lon;
    const cityChanged =
      city !== (before.city || (window.CONFIG || {}).CITY || '');
    if (cityChanged && city) {
      status.className = 'status';
      status.textContent = '正在解析城市经纬度…';
      const geo = await resolveCity(city);
      lat = geo.lat;
      lon = geo.lon;
    }

    const cards = {};
    document.querySelectorAll('#toggles input[data-card]').forEach((el) => {
      cards[el.dataset.card] = el.checked;
    });

    const next = {
      ...before,
      cards,
      city,
      glmKey: $('glm-key').value.trim(),
      nasHost: $('nas-host').value.trim() || '192.168.0.100',
      nasToken: $('nas-token').value.trim(),
      watch: $('watch').value
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (lat !== undefined) {
      next.lat = lat;
      next.lon = lon;
    }

    localStorage.setItem(LS_KEY, JSON.stringify(next));

    // 新启用的卡片需要拉起（已开着的会自行收到配置变更并重排位置）
    const beforeOn = before.cards || {};
    const newlyEnabled = Object.keys(cards).filter(
      (name) => cards[name] && beforeOn[name] === false,
    );
    for (const name of newlyEnabled) {
      await zebar.startWidgetPreset('desktop-widgets', name, 'default');
    }

    status.className = 'status ok';
    status.textContent = '已保存并应用' + (newlyEnabled.length ? `（已打开 ${newlyEnabled.length} 张卡片）` : '');
  } catch (err) {
    status.className = 'status err';
    status.textContent = `保存失败：${err.message ?? err}`;
  } finally {
    btn.disabled = false;
  }
}

$('save').addEventListener('click', save);
$('close').addEventListener('click', () => {
  zebar.currentWidget().close();
});

initForm();
