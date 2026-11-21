// 设置入口：点击拉起设置面板（DW.openWidget 内置三级调用回退）
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

document.getElementById('bar').addEventListener('click', function () {
  if (window.DW) {
    window.DW.openWidget('settings').catch(function (e) {
      showErr(String((e && e.message) || e));
    });
  }
});

applyLabel();
window.addEventListener('dw-config', applyLabel);
