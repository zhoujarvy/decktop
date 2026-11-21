// 天气：open-meteo 免费接口，支持 CORS 直连，无需走 shellExec
// 当前天气 + 7 天预报（图标 / 最高最低温）
(function () {
  let cfg = window.DW ? window.DW.config() : (window.CONFIG || {});

  // WMO weather code -> { 中文描述, 图标 }
  const WMO = {
    0: ['晴', '☀️'], 1: ['晴间少云', '🌤️'], 2: ['多云', '⛅'], 3: ['阴', '☁️'],
    45: ['雾', '🌫️'], 48: ['雾凇', '🌫️'],
    51: ['毛毛雨', '🌦️'], 53: ['毛毛雨', '🌦️'], 55: ['毛毛雨', '🌦️'],
    56: ['冻毛毛雨', '🌧️'], 57: ['冻毛毛雨', '🌧️'],
    61: ['小雨', '🌦️'], 63: ['中雨', '🌧️'], 65: ['大雨', '🌧️'],
    66: ['冻雨', '🌧️'], 67: ['冻雨', '🌧️'],
    71: ['小雪', '🌨️'], 73: ['中雪', '🌨️'], 75: ['大雪', '❄️'], 77: ['雪粒', '🌨️'],
    80: ['阵雨', '🌦️'], 81: ['阵雨', '🌧️'], 82: ['强阵雨', '⛈️'],
    85: ['阵雪', '🌨️'], 86: ['阵雪', '🌨️'],
    95: ['雷阵雨', '⛈️'], 96: ['雷阵雨伴冰雹', '⛈️'], 99: ['雷阵雨伴冰雹', '⛈️'],
  };
  const wmo = (code) => WMO[code] || ['未知', '🌡️'];

  const $ = (id) => document.getElementById(id);

  function showError(msg) {
    $('cond').textContent = msg;
    $('range').textContent = '';
    $('temp').textContent = '--°';
  }

  async function refresh() {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${cfg.LAT}&longitude=${cfg.LON}` +
      `&current=temperature_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&timezone=Asia%2FShanghai&forecast_days=7`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      $('city').textContent = cfg.CITY || '天气';

      const cur = data.current;
      const [desc, icon] = wmo(cur.weather_code);
      $('cur-icon').textContent = icon;
      $('temp').textContent = `${Math.round(cur.temperature_2m)}°`;
      $('cond').textContent = desc;

      const d = data.daily;
      $('range').textContent =
        `${Math.round(d.temperature_2m_min[0])}° / ${Math.round(d.temperature_2m_max[0])}°`;

      // 7 天预报（今天是 daily[0]，取后 6 天）
      const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
      let html = `<div class="d"><span>今天</span><span class="ico">${wmo(d.weather_code[0])[1]}</span>` +
        `<span class="hi">${Math.round(d.temperature_2m_max[0])}°</span>` +
        `<span class="lo">${Math.round(d.temperature_2m_min[0])}°</span></div>`;
      for (let i = 1; i <= 6; i++) {
        const date = new Date(d.time[i] + 'T00:00:00');
        html += `<div class="d"><span>周${WEEK[date.getDay()]}</span>` +
          `<span class="ico">${wmo(d.weather_code[i])[1]}</span>` +
          `<span class="hi">${Math.round(d.temperature_2m_max[i])}°</span>` +
          `<span class="lo">${Math.round(d.temperature_2m_min[i])}°</span></div>`;
      }
      $('days').innerHTML = html;
    } catch (err) {
      showError('获取失败，稍后重试');
      setTimeout(refresh, 5 * 60 * 1000);
    }
  }

  refresh();
  setInterval(refresh, 30 * 60 * 1000);

  // 设置面板改城市后热更新
  window.addEventListener('dw-config', (e) => {
    cfg = e.detail;
    refresh();
  });
})();
