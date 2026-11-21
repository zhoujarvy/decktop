// 设置面板：即时响应（卡片开关/语言立即生效），城市/密钥/NAS 走保存按钮
// 保存 -> localStorage(dw.config) -> 各卡片经 storage 事件/轮询热生效
const LS_KEY = 'dw.config';
const $ = (id) => document.getElementById(id);
const t = (key, vars) => window.DW.t(key, vars);

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeUser(next) {
  localStorage.setItem(LS_KEY, JSON.stringify(next));
}

// ---------- 多语言 ----------
let lang = 'zh';

function applyLang() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  $('close').title = t('panel.close');
  document.querySelectorAll('#lang-row button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  renderToggles();
}

// 即时切换语言并持久化（必须先写入再渲染：翻译函数读的是存储值）
function switchLang(next) {
  lang = next;
  const usr = readUser();
  usr.lang = lang;
  writeUser(usr);
  applyLang();
}

// ---------- 卡片开关（即时生效） ----------
function renderToggles() {
  const usr = readUser();
  const cardsOn = usr.cards || {};
  const stackCards = (window.DW_CARDS || []).filter(
    (c) => c.stack !== false && !c.fixed,
  );
  $('toggles').innerHTML = stackCards
    .map(
      (c) =>
        `<label><input type="checkbox" data-card="${c.name}" ` +
        `${cardsOn[c.name] !== false ? 'checked' : ''}/>${t('card.' + c.name)}</label>`,
    )
    .join('');
  bindToggles();
}

function bindToggles() {
  document.querySelectorAll('#toggles input[data-card]').forEach((el) => {
    el.addEventListener('change', () => {
      toggleCard(el.dataset.card, el.checked);
    });
  });
}

function toggleCard(name, on) {
  const usr = readUser();
  usr.cards = usr.cards || {};
  usr.cards[name] = on;
  writeUser(usr);

  const status = $('status');
  if (on) {
    // 新启用：立即拉起（关闭由卡片自己响应配置变更完成）
    window.DW.openWidget(name).then(() => {
      status.className = 'status ok';
      status.textContent = t('status.cardOpened', { n: t('card.' + name) });
    }).catch((e) => {
      status.className = 'status err';
      status.textContent = String(e.message ?? e).slice(0, 60);
    });
  } else {
    status.className = 'status ok';
    status.textContent = t('status.cardClosed', { n: t('card.' + name) });
  }
}

// ---------- 初始化表单 ----------
function initForm() {
  const usr = readUser();
  const def = window.CONFIG || {};

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
    throw new Error(t('geo.notfound', { c: city }));
  }
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude };
}

// ---------- 保存（城市/密钥/NAS 文本配置） ----------
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
      status.textContent = t('status.resolving');
      const geo = await resolveCity(city);
      lat = geo.lat;
      lon = geo.lon;
    }

    const next = {
      ...before,
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
    writeUser(next);

    status.className = 'status ok';
    status.textContent = t('status.saved');
  } catch (err) {
    status.className = 'status err';
    status.textContent = t('status.fail', { m: err.message ?? err });
  } finally {
    btn.disabled = false;
  }
}

$('save').addEventListener('click', save);
$('close').addEventListener('click', () => {
  window.ZEBAR.currentWidget().close();
});

// 清除自定义排列，所有卡片回到自动堆叠布局
$('reset-layout').addEventListener('click', () => {
  const usr = readUser();
  delete usr.layout;
  writeUser(usr);
  const status = $('status');
  status.className = 'status ok';
  status.textContent = t('status.reset');
});

document.querySelectorAll('#lang-row button').forEach((btn) => {
  btn.addEventListener('click', () => {
    switchLang(btn.dataset.lang);
  });
});

// ---------- 时钟选项（即时生效） ----------
function initClockToggles() {
  const clock = readUser().clock || {};
  document.querySelectorAll('#clock-toggles input[data-clock]').forEach((el) => {
    el.checked = clock[el.dataset.clock] !== false;
    el.addEventListener('change', () => {
      const usr = readUser();
      usr.clock = usr.clock || {};
      usr.clock[el.dataset.clock] = el.checked;
      writeUser(usr);
    });
  });
}

lang = readUser().lang || 'zh';
initForm();
initClockToggles();
applyLang();
