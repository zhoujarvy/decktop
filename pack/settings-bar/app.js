// 设置入口：点击拉起设置面板
document.getElementById('bar').addEventListener('click', function () {
  import('https://esm.sh/zebar@3').then(function (zebar) {
    return zebar.startWidgetPreset('desktop-widgets', 'settings', 'default');
  }).catch(function (e) {
    console.warn('[settings-bar] 打开设置失败:', e);
  });
});
