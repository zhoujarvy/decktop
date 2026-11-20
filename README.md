# 桌面小组件（zebar）

Windows 11 桌面常驻小组件，基于开源框架 [zebar](https://github.com/glzr-io/zebar) v3.3.1。

## 组件

| 组件 | 数据源 | 刷新 |
|---|---|---|
| 时钟 | 本地 | 每秒 |
| 天气（open-meteo，免 Key） | `api.open-meteo.com` | 30 分钟 |
| GLM · Code Plan 进度条 | 智谱 `/api/monitor/usage/quota/limit` + `/api/biz/account/query-customer-account-report` | 10 分钟（倒计时每分钟本地刷新，点击卡片手动刷新） |
| NAS 状态 | 飞牛上的 [FNOS-API](https://github.com/heijiangangqin/FNOS-API) `http://192.168.0.100:9932` | CPU/内存 10s，存储/容器 60s；离线自动降频探活 |

## 目录结构

```
D:\project\桌面小组件\
└─ pack/                  ← 通过 junction 映射到 ~/.glzr/zebar/desktop-widgets
   ├─ zpack.json          ← 窗口位置/尺寸/透明/置底 + shell 命令白名单
   ├─ config.js           ← 密钥配置（gitignore，不提交）
   ├─ config.example.js   ← 配置模板
   ├─ clock/  weather/  glm-balance/  nas/   ← 各组件 index.html + app.js
   └─ shared/style.css    ← 统一深色毛玻璃卡片样式
```

## 配置

复制 `pack/config.example.js` 为 `pack/config.js` 并填写：

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

## 同步部署

junction 已建好（源码即生效）。若换机器重建：

```bat
mklink /J "%USERPROFILE%\.glzr\zebar\desktop-widgets" "D:\project\桌面小组件\pack"
```

若 zebar 不识别 junction，用 robocopy 兜底：

```bat
robocopy "D:\project\桌面小组件\pack" "%USERPROFILE%\.glzr\zebar\desktop-widgets" /MIR
```
