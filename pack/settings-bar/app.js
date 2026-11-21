// 设置入口：点击拉起设置面板；标签跟随语言设置
function applyLabel() {
  if (window.DW) {
    var label = document.querySelector('#bar .label');
    label.style.color = '';
    label.className = 'label';
    label.textContent = window.DW.t('bar.label');
  }
}

document.getElementById('bar').addEventListener('click', function () {
  if (!window.ZEBAR) return;
  try {
    // isPreview 必须显式传 false，否则 invoke 参数缺字段会报 invalid args
    window.ZEBAR.startWidgetPreset('desktop-widgets', 'settings', 'default', false)
      .catch(function (e) {
        showErr(String((e && e.message) || e));
      });
  } catch (e) {
    showErr(String((e && e.message) || e));
  }
});

function showErr(msg) {
  var label = document.querySelector('#bar .label');
  label.textContent = msg.slice(0, 110);
  label.className = 'label errmsg';
  label.style.color = '#f7768e';
}

applyLabel();
window.addEventListener('dw-config', applyLabel);
