// 卡片引导脚本：配置合并 / 动态布局 / 开关响应 / 配置热更新广播
// 每个卡片 index.html 依次引入：../config.js -> ../shared/cards.js -> 本文件（在 app.js 之前）
(function () {
  var LS_KEY = 'dw.config';
  var CARD_WIDTH = 340;
  var RIGHT_MARGIN = 16;
  var TOP_MARGIN = 16;
  var GAP = 12;

  // ---------- 配置 ----------
  function readUser() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function mergedConfig() {
    var def = window.CONFIG || {};
    var usr = readUser();
    return {
      GLM_KEY: usr.glmKey !== undefined ? usr.glmKey : (def.GLM_KEY || ''),
      FNOS_TOKEN: usr.nasToken !== undefined ? usr.nasToken : (def.FNOS_TOKEN || ''),
      NAS_HOST: usr.nasHost || def.NAS_HOST || '192.168.0.100',
      CITY: usr.city || def.CITY || '',
      LAT: usr.lat !== undefined ? usr.lat : def.LAT,
      LON: usr.lon !== undefined ? usr.lon : def.LON,
      WATCH_CONTAINERS: usr.watch || def.WATCH_CONTAINERS || [],
    };
  }

  // ---------- 布局 ----------
  function enabledStack() {
    var on = readUser().cards || {};
    return (window.DW_CARDS || []).filter(function (c) {
      return c.stack !== false && (c.fixed || on[c.name] !== false);
    });
  }

  function yFor(name) {
    var y = TOP_MARGIN;
    var list = enabledStack();
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === name) return y;
      y += list[i].height + GAP;
    }
    return null; // 不在启用列表
  }

  // 计算卡片槽位（列号, y）。主列放不下自动换到左侧第二列，避免超出屏幕
  function slotFor(name, usableHeight) {
    var list = enabledStack();
    var y = TOP_MARGIN;
    var col = 0;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var overflow = y + c.height > usableHeight && y > TOP_MARGIN;
      if (overflow) {
        col += 1;
        y = TOP_MARGIN;
      }
      if (c.name === name) return { col: col, y: y };
      y += c.height + GAP;
    }
    return null;
  }

  // 从 URL 推断卡片名（.../<card>/index.html）
  var CARD = (location.pathname.match(/\/([^/]+)\/index\.html$/) || [])[1];

  var ZEBAR_URL = 'https://esm.sh/zebar@3';

  function dbgSet() {} // 诊断已完成，保留空实现避免改动调用点

  function place() {
    if (!CARD) return Promise.resolve();
    // 非堆叠卡片（如设置面板）不参与布局与开关管理
    var entry = (window.DW_CARDS || []).filter(function (c) { return c.name === CARD; })[0];
    if (entry && entry.stack === false) return Promise.resolve();
    if (yFor(CARD) === null) {
      // 被禁用：自关闭
      return import(ZEBAR_URL).then(function (zebar) {
        return zebar.currentWidget().close();
      }).catch(function () {});
    }
    return import(ZEBAR_URL).then(function (zebar) {
      // 用浏览器原生 screen（当前显示器的逻辑尺寸），
      // 避免 zebar 未授权的 currentMonitor Tauri 权限
      var usableH = (window.screen.availHeight || window.screen.height) - 16;
      var slot = slotFor(CARD, usableH);
      if (!slot) return;
      var xLogical = window.screen.width - RIGHT_MARGIN - CARD_WIDTH
        - slot.col * (CARD_WIDTH + GAP);
      var win = zebar.currentWidget().tauriWindow;
      // 带 type 标记的对象按 LogicalPosition 反序列化
      return win.setPosition({
        type: 'Logical',
        x: Math.round(xLogical),
        y: Math.round(slot.y),
      }).then(function () {
        dbgSet('placed c' + slot.col + ' y' + slot.y);
      });
    }).catch(function (e) {
      dbgSet('ERR ' + String(e && e.message || e).slice(0, 50));
      console.warn('[boot] place failed:', e);
    });
  }

  // ---------- 配置变更响应（storage 事件 + 3s 轮询双保险） ----------
  var lastRaw = localStorage.getItem(LS_KEY);

  function onConfigChanged() {
    place();
    window.dispatchEvent(new CustomEvent('dw-config', { detail: mergedConfig() }));
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== LS_KEY) return;
    lastRaw = localStorage.getItem(LS_KEY);
    onConfigChanged();
  });

  setInterval(function () {
    var raw = localStorage.getItem(LS_KEY);
    if (raw !== lastRaw) {
      lastRaw = raw;
      onConfigChanged();
    }
  }, 3000);

  // ---------- 暴露给卡片 app ----------
  window.DW = {
    key: LS_KEY,
    card: CARD,
    config: mergedConfig,
    userConfig: readUser,
    place: place,
  };

  place();
})();
