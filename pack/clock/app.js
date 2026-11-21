// 时钟：24h/秒可配（设置面板即时生效），右侧显示农历/生肖/节气
(function () {
  var sl = window.solarLunar
    ? (window.solarLunar.default || window.solarLunar)
    : null;
  var cfg = window.DW ? window.DW.config() : {};

  function render() {
    var now = new Date();
    var h = now.getHours();
    var hh;
    var ampm = '';
    if (cfg.CLOCK_24 !== false) {
      hh = String(h).padStart(2, '0');
    } else {
      ampm = h >= 12 ? 'PM' : 'AM';
      hh = String(h % 12 || 12).padStart(2, '0');
    }
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');

    document.getElementById('time').innerHTML =
      `${hh}:${mm}` +
      (cfg.CLOCK_SECONDS !== false ? `<span class="sec">${ss}</span>` : '') +
      (ampm ? `<span class="ampm">${ampm}</span>` : '');

    document.getElementById('date').textContent =
      `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${'日一二三四五六'[now.getDay()]}`;
  }

  function renderLunar() {
    if (!sl) return;
    var now = new Date();
    var r = sl.solar2lunar(now.getFullYear(), now.getMonth() + 1, now.getDate());
    document.getElementById('lunar-date').textContent =
      (r.isLeap ? '闰' : '') + r.monthCn + r.dayCn;
    document.getElementById('lunar-year').textContent = r.gzYear + r.animal + '年';
    document.getElementById('term').textContent = r.isTerm && r.term ? r.term : '';
  }

  render();
  renderLunar();
  setInterval(render, 1000);
  // 跨天时刷新农历
  setInterval(function () {
    renderLunar();
  }, 10 * 60 * 1000);

  // 设置变更（24h/秒）热生效
  window.addEventListener('dw-config', function (e) {
    cfg = e.detail;
    render();
  });
})();
