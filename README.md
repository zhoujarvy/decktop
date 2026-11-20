# 桌面小组件（zebar）

Windows 11 桌面常驻小组件，基于开源框架 [zebar](https://github.com/glzr-io/zebar) v3.3.1。
v2：卡片插件化 + 可视化设置面板 + 日历（农历）。

## 组件

| 组件 | 数据源 | 刷新 |
|---|---|---|
| 本机状态（CPU/内存/网速） | zebar 内置 provider | 2-3s 自动推送 |
| 时钟 | 本地 | 每秒 |
| 日历（月历+今日农历+翻月） | 本地 + 内置 solarlunar | 常驻 |
| 天气（open-meteo，免 Key） | `api.open-meteo.com` | 30 分钟 |
| GLM · Code Plan 进度条 | 智谱 `/api/monitor/usage/quota/limit` + `/api/biz/account/query-customer-account-report` | 10 分钟（倒计时每分钟本地刷新，点击卡片手动刷新） |
| NAS 状态 | 飞牛上的 [FNOS-API](https://github.com/heijiangangqin/FNOS-API) `http://192.168.0.100:9932` | CPU/内存 10s，存储/容器 60s；离线自动降频探活 |

## 目录结构

```
D:\project\桌面小组件\
├─ tools/build-pack.py      ← 从 cards.js 注册表生成 zpack.json
└─ pack/                  ← 通过 junction 映射到 ~/.glzr/zebar/desktop-widgets
   ├─ zpack.json          ← 【生成物】窗口声明 + curl 白名单
   ├─ config.js           ← 出厂默认配置（gitignore；用户设置存 localStorage，优先级更高）
   ├─ config.example.js   ← 配置模板
   ├─ shared/
   │  ├─ cards.js         ← 卡片注册表（插件机制核心，严格 JSON）
   │  ├─ boot.js          ← 卡片引导：配置合并/动态布局（自动换列）/开关响应/热更新
   │  ├─ style.css        ← 统一深色毛玻璃卡片样式
   │  └─ solarlunar.min.js← 农历库（ISC，github.com/waterbeside/solarlunar）
   └─ system/ clock/ calendar/ weather/ glm-balance/ nas/ settings-bar/ settings/
                            ← 各卡片 index.html + app.js
```

## 新增卡片（插件方式）

1. 新建 `pack/<name>/index.html + app.js`（开头依次引入 `../config.js`、
   `../shared/cards.js`、`../shared/boot.js`；数据卡片监听 `dw-config` 事件热更新）
2. 在 `pack/shared/cards.js` 登记一行（name/title/height，需要 curl 的加 `shell`）
3. `python tools/build-pack.py` 生成 zpack.json，重启 zebar
4. 首次启动：`zebar.exe start-widget-preset --pack desktop-widgets --widget-name <name> --preset default`

## 可视化设置

桌面右下"设置"条 → 设置面板：**中/英界面语言切换**、卡片开关（不想要的卡直接关，如无 NAS 用户）、
天气城市（open-meteo 自动解析经纬度）、GLM API Key、NAS 地址/Token/关注容器。
保存后立即生效：关闭/打开卡片、其余卡片自动上移补位，改配置热更新（storage 事件 + 3s 轮询双保险）。
文案字典在 `pack/shared/i18n.js`，加新语言只需增加一个同结构的键值对象。

## 外出访问 NAS（笔记本不在家）

- **Tailscale（推荐）**：NAS 与笔记本各装 Tailscale（NAS 用 Docker），组虚拟局域网。
  设置面板把 NAS 地址改成 NAS 的 Tailscale IP（100.x.x.x）即可，全程加密、零公网暴露。
- **Lucky DDNS + 反代**：有公网 IP/IPv6 时，Lucky 绑定域名 + ACME 证书，反代 fnOS 与
  FNOS-API(:9932)。注意：公网明文 http 传 Token 不安全，务必走 HTTPS。
- 小组件的 curl 白名单已支持任意 IP/域名:9932（`https?://[a-zA-Z0-9.-]+:9932`）。

## 配置

复制 `pack/config.example.js` 为 `pack/config.js` 并填写（作为出厂默认，设置面板的值优先）：

- `GLM_KEY`：智谱开放平台 API Key（`{id}.{secret}` 格式）
- `FNOS_TOKEN`：NAS 上 FNOS-API 的 api_token（在 NAS 的
  `/vol2/@appdata/fnos-api-gw/data/config.json` 里，忘了可去看或删除后重装重设）
- `CITY` / `LAT` / `LON`：天气城市与经纬度
- `WATCH_CONTAINERS`：NAS 上关注的 Docker 容器名（字符串包含匹配），留空显示全部

## 日常使用

- **改代码/配置后生效**：托盘 zebar 图标 → Widget packs → desktop-widgets → 对应 widget 的 Reload（或重启 zebar 后执行 `zebar.exe startup`）
- **开机自启**：已写入 `~/.glzr/zebar/settings.json` 的 `startupConfigs`（zebar 随系统启动后自动拉起 4 个组件）
- **调整位置/大小**：改 `pack/zpack.json` 里各 widget 的 `presets`（offsetX/Y、width、height），重启 zebar 生效

## 踩坑记录（重要）

1. **includeFiles 必填**：zpack.json 里每个 widget 必须配置 `includeFiles`（glob 白名单），
   否则 zebar 内置资源服务器对所有文件返回 404（空白/404 卡片）。glob 的 `*` 不跨目录，
   子目录要用 `**/*.html` 这类写法。
2. **自定义 API 走 curl 而非 fetch**：widget 内 fetch 受 CORS 限制（带 Authorization 头会预检失败）。
   zpack.json 的 `privileges.shellCommands` 声明 curl 白名单后用
   `zebar.shellExec('C:\\Windows\\System32\\curl.exe', [...])`（用绝对路径，避免 PATH 里 Git 的 curl 抢先）。
   `argsRegex` 是对**参数数组 join 后的整串**做部分匹配，写 `^...$` 全串锚定保证安全。
3. **zebar 资源服务器**（127.0.0.1:6124）带 Cookie 鉴权，无法直接 curl 调试。
4. **offsetX 方向**：`top_right` 锚点下正值向外（屏幕外），想内缩 16px 要写 `-16px`。
5. **GLM 余额接口**：官方 `/api/paas/v4/users/balance_info` 已下线（404）；
   可用的是 `/api/biz/account/query-customer-account-report`（余额）和
   `/api/monitor/usage/quota/limit`（额度池，含 5 小时窗口用量与 nextResetTime），
   均为 API Key 直接 Bearer，无需 JWT。
6. **tauriWindow.setPosition 参数**：必须是 Logical/PhysicalPosition 形状，
   传普通 `{x,y}` 会报"must be either a LogicalPo..."——带类型标记 `{type:'Logical', x, y}` 即可；
   `currentMonitor()` 需要 zebar 未授权的权限，改用浏览器原生 `window.screen`。
7. **GUI 启动会自动拉起 startupConfigs**：重启 zebar 后不要再手动跑 `zebar startup`，会重复开窗。
8. **调试技巧**：诊断信息可用 `tauriWindow.setTitle()` 写进窗口标题，外部枚举窗口即可读取
   （`document.title` 不会同步到原生标题）；PrintWindow 抓图前必须 SetProcessDPIAware。
9. **同 pack 共享 localStorage**（zebar 按 pack 分 WebView data 目录、同源），
   这是运行时配置跨卡片共享的基础；`storage` 事件只在其他窗口触发，本窗口要自行处理。

## 同步部署

junction 已建好（源码即生效）。若换机器重建：

```bat
mklink /J "%USERPROFILE%\.glzr\zebar\desktop-widgets" "D:\project\桌面小组件\pack"
```

若 zebar 不识别 junction，用 robocopy 兜底：

```bat
robocopy "D:\project\桌面小组件\pack" "%USERPROFILE%\.glzr\zebar\desktop-widgets" /MIR
```
