const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function render() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  document.getElementById('time').innerHTML =
    `${hh}:${mm}<span class="sec">${ss}</span>`;

  document.getElementById('date').textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK[now.getDay()]}`;
}

render();
setInterval(render, 1000);
