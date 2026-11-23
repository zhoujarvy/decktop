// 卡片注册表（插件机制）：新增卡片 = 建目录(pack/<name>/index.html+app.js) + 在此登记
// + 运行 python tools/build-pack.py 重新生成 zpack.json + 重启 zebar。
// 注意：数组必须是严格 JSON（双引号），tools/build-pack.py 会直接解析它。
// 字段：name=目录名  title=设置界面显示名  height=卡片高度(px)
//       stack=false 表示不参与右列布局（如悬浮面板）
//       fixed=true 表示不可在设置中关闭（如设置入口本身）
//       shell="glm"|"nas" 表示需要对应 curl 命令白名单
window.DW_CARDS = [
  { "name": "system",       "title": "本机状态", "height": 112 },
  { "name": "clock",        "title": "时钟",     "height": 100 },
  { "name": "calendar",     "title": "日历",     "height": 240 },
  { "name": "weather",      "title": "天气",     "height": 144, "shell": "weather" },
  { "name": "glm-balance",  "title": "GLM 用量", "height": 116, "shell": "glm" },
  { "name": "nas",          "title": "NAS 状态", "height": 176, "shell": "nas" },
  { "name": "settings-bar", "title": "设置入口", "height": 36,  "fixed": true },
  { "name": "settings",     "title": "设置面板", "height": 640, "stack": false }
];
