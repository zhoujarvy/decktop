// 复制本文件为 config.js 并填入真实值（config.js 已被 gitignore，不会提交）
window.CONFIG = {
  // 智谱开放平台 API Key，格式 "{id}.{secret}"，从 open.bigmodel.cn 控制台获取
  GLM_KEY: '',

  // FNOS-API 的 Bearer Token（NAS 上安装 FNOS-API 后获得）
  FNOS_TOKEN: '',

  // NAS 上 FNOS-API 的地址（不含结尾斜杠）
  NAS_HOST: '192.168.0.100',

  // 天气城市与经纬度（当前：广州）
  CITY: '广州',
  LAT: 23.1291,
  LON: 113.2644,

  // NAS 上关注存活的 Docker 容器名列表，留空则显示全部容器
  WATCH_CONTAINERS: [],
};
