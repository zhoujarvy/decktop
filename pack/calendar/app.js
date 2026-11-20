// 日历卡：月历网格（周一起）+ 今日高亮 + 今日农历 + 翻月
// 农历换算使用内置 solarlunar（ISC 许可，见 README）
(function () {
  var sl = window.solarLunar;
  var today = new Date();
  // 当前查看的年月
  var view = { y: today.getFullYear(), m: today.getMonth() };

  function $(id) { return document.getElementById(id); }

  function renderHead() {
    $('month').textContent = view.y + '年' + (view.m + 1) + '月';
    var r = sl.solar2lunar(today.getFullYear(), today.getMonth() + 1, today.getDate());
    $('lunar-today').textContent =
      '农历' + r.gzYear + r.animal + '年 · ' + (r.isLeap ? '闰' : '') + r.monthCn + r.dayCn;
  }

  function renderGrid() {
    var first = new Date(view.y, view.m, 1);
    // 周一=0 … 周日=6
    var startWeekday = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    var prevDays = new Date(view.y, view.m, 0).getDate();

    var html = ['<span class="wd">一</span><span class="wd">二</span><span class="wd">三</span>',
      '<span class="wd">四</span><span class="wd">五</span><span class="wd" style="color:rgba(247,118,142,.5)">六</span>',
      '<span class="wd" style="color:rgba(247,118,142,.5)">日</span>'].join('');

    var cells = [];
    // 上月尾部
    for (var i = startWeekday - 1; i >= 0; i--) {
      cells.push({ d: prevDays - i, dim: true });
    }
    // 本月
    for (var d = 1; d <= daysInMonth; d++) {
      cells.push({ d: d, dim: false });
    }
    // 下月头部（补满 6 行 42 格）
    for (var n = 1; cells.length < 42; n++) {
      cells.push({ d: n, dim: true });
    }

    var isThisMonth = view.y === today.getFullYear() && view.m === today.getMonth();

    cells.forEach(function (c, idx) {
      var cls = 'day';
      if (c.dim) cls += ' dim';
      var weekday = idx % 7;
      if (weekday >= 5) cls += ' weekend';
      if (!c.dim && isThisMonth && c.d === today.getDate()) cls += ' today';
      html += '<span class="' + cls + '">' + c.d + '</span>';
    });

    $('grid').innerHTML = html;
  }

  function render() {
    renderHead();
    renderGrid();
  }

  function shift(delta) {
    var d = new Date(view.y, view.m + delta, 1);
    view = { y: d.getFullYear(), m: d.getMonth() };
    render();
  }

  $('prev').addEventListener('click', function () { shift(-1); });
  $('next').addEventListener('click', function () { shift(1); });
  $('back-today').addEventListener('click', function () {
    view = { y: today.getFullYear(), m: today.getMonth() };
    render();
  });

  // 跨天时刷新“今日”高亮（每 10 分钟检查一次日期变化）
  setInterval(function () {
    var now = new Date();
    if (now.toDateString() !== today.toDateString()) {
      today = now;
      view = { y: now.getFullYear(), m: now.getMonth() };
      render();
    }
  }, 10 * 60 * 1000);

  render();
})();
