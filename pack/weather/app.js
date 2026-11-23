// 天气：和风天气（国内直连，curl -4 带 X-QW-Api-Key 头规避 CORS/IPv6 问题）
//  - GET geoapi.qweather.com/v2/city/lookup   城市 -> LocationID（缓存到 dw.config）
//  - GET devapi.qweather.com/v7/weather/now   实况
//  - GET devapi.qweather.com/v7/weather/7d    7 天预报
(function () {
  let cfg = window.DW ? window.DW.config() : (window.CONFIG || {});
  const CURL = 'C:\\Windows\\System32\\curl.exe';

  // 和风 icon 代码 -> 图标（按段映射 + 少量特例）
  function qIcon(code) {
    code = String(code);
    if (code === '100' || code === '150') return '☀️';
    if (code === '101' || code === '151') return '⛅';
    if (code === '102' || code === '103' || code === '152' || code === '153') return '🌤️';
    if (code === '104') return '☁️';
    if (code === '300' || code === '305' || code === '350') return '🌦️';
    if (code === '302' || code === '303' || code === '304') return '⛈️';
    if (code.startsWith('3')) return '🌧️';
    if (code === '313' || code === '403' || code === '499') return '❄️';
    if (code.startsWith('4')) return '🌨️';
    if (code.startsWith('5')) return '🌫️';
    return '🌡️';
  }

  const $ = (id) => document.getElementById(id);

  let lastGood = null;
  let failStreak = 0;

  function showError(msg) {
    if (lastGood) {
      $('cond').textContent = `${lastGood.cond}（${msg}）`;
      return;
    }
    $('cond').textContent = msg;
    $('range').textContent = '';
    $('temp').textContent = '--°';
    $('cur-icon').textContent = '';
  }

  function scheduleRetry() {
    failStreak += 1;
    setTimeout(refresh, failStreak <= 3 ? 30 * 1000 : 5 * 60 * 1000);
  }

  async function qw(url) {
    const out = await window.ZEBAR.shellExec(CURL, [
      '-s', '-4', '-m', '15',
      '-H', `X-QW-Api-Key: ${cfg.WEATHER_KEY}`,
      url,
    ]);
    if (out.code !== 0) throw new Error(`curl exit ${out.code}`);
    const json = JSON.parse(out.stdout);
    if (json.code !== '200') {
      throw new Error(`和风 ${json.code}${json.error ? ' ' + json.error : ''}`);
    }
    return json;
  }

  // 城市名 -> LocationID（成功后缓存进 dw.config.weatherLoc）
  async function resolveLocation() {
    const city = (cfg.CITY || '').trim();
    if (!city) throw new Error('未设置城市');
    const geo = await qw(
      `https://geoapi.qweather.com/v2/city/lookup?location=${encodeURIComponent(city)}&number=1`,
    );
    const hit = geo.location && geo.location[0];
    if (!hit) throw new Error(`找不到城市“${city}”`);
    const usr = window.DW.userConfig();
    usr.weatherLoc = { id: hit.id, name: hit.name };
    localStorage.setItem(window.DW.key, JSON.stringify(usr));
    return usr.weatherLoc;
  }

  async function refresh() {
    if (!cfg.WEATHER_KEY) {
      showError('请在设置面板填和风天气 Key');
      return;
    }
    try {
      let loc = window.DW.userConfig().weatherLoc;
      if (!loc) loc = await resolveLocation();

      $('city').textContent = cfg.CITY || loc.name;

      const [now, week] = await Promise.all([
        qw(`https://devapi.qweather.com/v7/weather/now?location=${loc.id}`),
        qw(`https://devapi.qweather.com/v7/weather/7d?location=${loc.id}`),
      ]);
      failStreak = 0;

      const n = now.now;
      $('cur-icon').textContent = qIcon(n.icon);
      $('temp').textContent = `${Math.round(Number(n.temp))}°`;
      $('cond').textContent = n.text;
      $('range').textContent =
        `${Math.round(Number(week.daily[0].tempMin))}° / ${Math.round(Number(week.daily[0].tempMax))}°`;

      const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
      let html = `<div class="d"><span>今天</span><span class="ico">${qIcon(week.daily[0].iconDay)}</span>` +
        `<span class="hi">${Math.round(Number(week.daily[0].tempMax))}°</span>` +
        `<span class="lo">${Math.round(Number(week.daily[0].tempMin))}°</span></div>`;
      for (let i = 1; i < Math.min(7, week.daily.length); i++) {
        const d = week.daily[i];
        const date = new Date(d.fxDate + 'T00:00:00');
        html += `<div class="d"><span>周${WEEK[date.getDay()]}</span>` +
          `<span class="ico">${qIcon(d.iconDay)}</span>` +
          `<span class="hi">${Math.round(Number(d.tempMax))}°</span>` +
          `<span class="lo">${Math.round(Number(d.tempMin))}°</span></div>`;
      }
      $('days').innerHTML = html;

      lastGood = { cond: n.text };
    } catch (err) {
      showError(String(err.message ?? err).slice(0, 40));
      scheduleRetry();
    }
  }

  refresh();
  setInterval(refresh, 30 * 60 * 1000);

  // 设置面板改城市/Key 后热更新
  window.addEventListener('dw-config', (e) => {
    cfg = e.detail;
    refresh();
  });
})();
