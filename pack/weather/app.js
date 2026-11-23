// 天气：和风天气（国内直连 devapi，curl --compressed 解 gzip；--compressed 规避 IPv6）
//  - 城市解析：geocoding-api.open-meteo.com（免 Key，国内可达）-> 经纬度
//  - 实况：devapi.qweather.com/v7/weather/now?location=lon,lat
//  - 7天：devapi.qweather.com/v7/weather/7d?location=lon,lat
(function () {
  let cfg = window.DW ? window.DW.config() : (window.CONFIG || {});
  const CURL = 'C:\\Windows\\System32\\curl.exe';

  // 和风 icon 代码 -> 图标
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

  function parseJson(text) {
    if (!text || !text.trim()) throw new Error('空响应(接口路径或参数有误)');
    return JSON.parse(text);
  }

  async function curl(url, key) {
    const args = ['-s', '-4', '--compressed', '-m', '15'];
    if (key) args.push('-H', `X-QW-Api-Key: ${key}`);
    args.push(url);
    const out = await window.ZEBAR.shellExec(CURL, args);
    if (out.code !== 0) throw new Error(`curl exit ${out.code}`);
    return parseJson(out.stdout);
  }

  // 城市名 -> 经纬度（open-meteo geocoding，免 Key），缓存到 dw.config.weatherLoc
  async function resolveLocation() {
    const city = (cfg.CITY || '').trim();
    if (!city) throw new Error('未设置城市');
    const geo = await curl(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`,
    );
    const hit = geo.results && geo.results[0];
    if (!hit) throw new Error(`找不到城市“${city}”`);
    const loc = { coords: `${hit.longitude},${hit.latitude}`, name: hit.name };
    const usr = window.DW.userConfig();
    usr.weatherLoc = loc;
    localStorage.setItem(window.DW.key, JSON.stringify(usr));
    return loc;
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
        curl(`https://devapi.qweather.com/v7/weather/now?location=${loc.coords}`, cfg.WEATHER_KEY),
        curl(`https://devapi.qweather.com/v7/weather/7d?location=${loc.coords}`, cfg.WEATHER_KEY),
      ]);
      if (now.code !== '200') throw new Error(`和风 ${now.code}`);
      if (week.code !== '200') throw new Error(`和风 ${week.code}`);
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
