// 卡片引导脚本：配置合并 / 动态布局（含用户自定义位置）/ 拖动磁吸 / 配置热更新
// 每个卡片 index.html 依次引入：../config.js -> ../shared/cards.js ->（i18n.js）
// -> ../shared/zebar.bundle.js -> 本文件（在 app.js 之前）。需要拖动的元素加 data-drag。
(function () {
  var LS_KEY = 'dw.config';
  var CARD_WIDTH = 340;
  var PANEL_WIDTH = 380;
  var RIGHT_MARGIN = 16;
  var TOP_MARGIN = 16;
  var GAP = 12;
  var SNAP_THRESHOLD = 16;

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

  // 从 URL 推断卡片名（.../<card>/index.html）
  var CARD = (location.pathname.match(/\/([^/]+)\/index\.html$/) || [])[1];

  function me() {
    return (window.DW_CARDS || []).filter(function (c) {
      return c.name === CARD;
    })[0];
  }

  function enabledStack() {
    var on = readUser().cards || {};
    return (window.DW_CARDS || []).filter(function (c) {
      return c.stack !== false && (c.fixed || on[c.name] !== false);
    });
  }

  function win() {
    return window.ZEBAR ? window.ZEBAR.currentWidget().tauriWindow : null;
  }

  // ---------- 布局：各卡片目标矩形（逻辑坐标，含用户覆盖） ----------
  function allRects() {
    var rects = {};
    var y = TOP_MARGIN;
    var col = 0;
    var usableH = (window.screen.availHeight || window.screen.height) - 16;
    var x0 = window.screen.width - RIGHT_MARGIN - CARD_WIDTH;

    enabledStack().forEach(function (c) {
      if (y + c.height > usableH && y > TOP_MARGIN) {
        col += 1;
        y = TOP_MARGIN;
      }
      rects[c.name] = {
        x: x0 - col * (CARD_WIDTH + GAP),
        y: y,
        w: CARD_WIDTH,
        h: c.height,
      };
      y += c.height + GAP;
    });

    var ov = readUser().layout || {};
    Object.keys(rects).forEach(function (n) {
      if (ov[n] && typeof ov[n].x === 'number') {
        rects[n].x = ov[n].x;
        rects[n].y = ov[n].y;
      }
    });
    return rects;
  }

  function withDpr(xLogical, yLogical) {
    var w = win();
    if (!w) return Promise.resolve();
    // 必须用 LogicalPosition 类型（纯 {x,y} 对象 Tauri 不接受）
    return w.setPosition(
      new window.ZEBAR.LogicalPosition(Math.round(xLogical), Math.round(yLogical)),
    );
  }

  function place() {
    if (!CARD) return Promise.resolve();
    var self = me();

    // 面板类：不参与堆叠布局；设置面板固定居中
    if (self && self.stack === false) {
      if (CARD === 'settings') {
        var h = self.height;
        return withDpr(
          (window.screen.width - PANEL_WIDTH) / 2,
          (window.screen.availHeight || window.screen.height) / 2 - h / 2,
        );
      }
      return Promise.resolve();
    }

    var rects = allRects();
    if (!rects[CARD]) {
      // 被禁用：自关闭
      try {
        return window.ZEBAR.currentWidget().close();
      } catch (e) {
        return Promise.resolve();
      }
    }
    return withDpr(rects[CARD].x, rects[CARD].y);
  }

  // ---------- 拖动 + 磁吸（data-drag 元素） ----------
  function snap(pos) {
    var rects = allRects();
    delete rects[CARD];
    var best = { x: pos.x, y: pos.y, d: Infinity };

    function consider(x, y) {
      var d = Math.abs(x - pos.x) + Math.abs(y - pos.y);
      if (d < best.d) best = { x: x, y: y, d: d };
    }

    var targets = Object.keys(rects).map(function (k) { return rects[k]; });
    // 屏幕右上角锚点
    targets.push({
      x: window.screen.width - RIGHT_MARGIN - CARD_WIDTH,
      y: TOP_MARGIN, w: CARD_WIDTH, h: 0,
    });

    targets.forEach(function (r) {
      consider(r.x, pos.y); // 左缘对齐
      consider(r.x, r.y); // 位置对齐
      consider(r.x, r.y + r.h + GAP); // 排到其正下方
      consider(pos.x, r.y); // 仅水平线对齐
      consider(pos.x, r.y + r.h + GAP);
    });

    return best.d <= SNAP_THRESHOLD * 2 ? { x: best.x, y: best.y } : pos;
  }

  function saveLayout(pos) {
    var usr = readUser();
    usr.layout = usr.layout || {};
    usr.layout[CARD] = { x: Math.round(pos.x), y: Math.round(pos.y) };
    localStorage.setItem(LS_KEY, JSON.stringify(usr));
  }

  function initDrag() {
    var handles = document.querySelectorAll('[data-drag]');
    if (!handles.length || !CARD) return;
    var w = win();
    if (!w) return;

    handles.forEach(function (el) {
      el.style.cursor = 'move';
      el.title = '拖动调整位置（自动磁吸对齐）';
      el.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        if (e.target.closest && e.target.closest('.no-drag')) return;
        e.preventDefault();

        var startX = e.screenX;
        var startY = e.screenY;
        var base = null;
        var moved = false;

        w.outerPosition().then(function (p) { base = { x: p.x, y: p.y }; });

        function onMove(ev) {
          if (!base) return;
          var dx = ev.screenX - startX;
          var dy = ev.screenY - startY;
          if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
          moved = true;
          w.setPosition(new window.ZEBAR.PhysicalPosition(base.x + dx, base.y + dy));
        }

        function onUp() {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          if (!moved) return;
          var dpr = window.devicePixelRatio || 1;
          w.outerPosition().then(function (p) {
            var logical = { x: p.x / dpr, y: p.y / dpr };
            var isPanel = me() && me().stack === false;
            var target = isPanel ? logical : snap(logical);
            return withDpr(target.x, target.y).then(function () {
              if (!isPanel) saveLayout(target);
            });
          });
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
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

  // ---------- 多语言 ----------
  function t(key, vars) {
    var lang = readUser().lang || 'zh';
    var dict = (window.DW_I18N || {})[lang] || (window.DW_I18N || {}).zh || {};
    var s = dict[key] !== undefined ? dict[key]
      : ((window.DW_I18N || {}).zh || {})[key] !== undefined ? window.DW_I18N.zh[key]
      : key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  // ---------- 暴露给卡片 app ----------
  window.DW = {
    key: LS_KEY,
    card: CARD,
    config: mergedConfig,
    userConfig: readUser,
    place: place,
    t: t,
  };

  place();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrag);
  } else {
    initDrag();
  }
})();
