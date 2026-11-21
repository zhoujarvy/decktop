// 设置入口：依次尝试 snake_case / camelCase / 包装函数三种调用方式打开设置面板，
// 成功一种即记住（结果序号短暂显示在标签上便于诊断）。
function applyLabel() {
  if (window.DW) {
    var label = document.querySelector('#bar .label');
    label.style.color = '';
    label.className = 'label';
    label.textContent = window.DW.t('bar.label');
  }
}

function showErr(msg) {
  var label = document.querySelector('#bar .label');
  label.textContent = String(msg).slice(0, 90);
  label.className = 'label errmsg';
  label.style.color = '#f7768e';
}

function tryOpen() {
  var z = window.ZEBAR;
  if (!z) return;

  // 方式1：原生 invoke + snake_case 参数
  var p1 = z.rawInvoke('start_widget_preset', {
    pack_id: 'desktop-widgets',
    widget_name: 'settings',
    preset_name: 'default',
    is_preview: false,
  });

  // 方式2：原生 invoke + camelCase 参数
  var p2 = z.rawInvoke('start_widget_preset', {
    packId: 'desktop-widgets',
    widgetName: 'settings',
    presetName: 'default',
    isPreview: false,
  });

  // 方式3：官方包装函数
  var p3 = z.startWidgetPreset('desktop-widgets', 'settings', 'default', false);

  p1.then(function () { return { tag: 'snake-ok' }; },
          function (e) { return { tag: 'snake-err', e: e }; })
    .then(function (r1) {
      if (r1.tag === "snake-ok") { flash(); return; }
      return p2.then(function () { return { tag: 'camel-ok' }; },
                     function (e) { return { tag: 'camel-err', e: e }; })
        .then(function (r2) {
          if (r2.tag === "camel-ok") { flash(); return; }
          return p3.then(function () { return { tag: 'wrap-ok' }; },
                         function (e) { return { tag: 'wrap-err', e: e }; })
            .then(function (r3) {
              if (r3.tag === "wrap-ok") { flash(); return; }
              showErr(r1.tag + '/' + r2.tag + '/' + r3.tag + ' ' +
                String(r3.e && r3.e.message || r3.e).slice(0, 40));
            });
        });
    });
}

function flash() {
  // 成功时静默（不打扰）；诊断信息只在出错时显示
}

document.getElementById('bar').addEventListener('click', tryOpen);

applyLabel();
window.addEventListener('dw-config', applyLabel);
