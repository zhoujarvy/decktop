# Decktop

> Windows 11 桌面小组件套件：一叠贴在桌面上的毛玻璃卡片。基于 [zebar](https://github.com/glzr-io/zebar) v3.3.1。

Windows 11 桌面常驻小组件，基于开源框架 [zebar](https://github.com/glzr-io/zebar) v3.3.1。
贴桌面置底、深色毛玻璃卡片风、插件化卡片注册表、可视化设置面板（中英双语）、卡片可拖动磁吸排列。

## 卡片一览

| 卡片 | 内容 | 数据源 | 刷新 |
|---|---|---|---|
| 本机状态 | 主机名 / CPU / 内存 / 实时网速 | zebar 内置 provider | 2-3s 推送 |
| 时钟 | 时间（24h/秒可配）+ 日期 + 农历/生肖/节气 | 内置 solarlunar | 每秒 / 跨天 |
| 日历 | 月历网格（周一起）+ 今日高亮 + 点击日期查农历 + 翻月 | 内置 solarlunar | 交互即时 |
| 天气 | 当前天气（图标+温度）+ 7 天预报（图标 + 最高/最低温） | [open-meteo](https://open-meteo.com)（免 Key，CORS 直连） | 30 分钟 |
| GLM · Code Plan | 用量进度条 + **窗口时间进度条**（倒计时，h:mm）+ 重置时间 + 余额 | 智谱 `/api/monitor/usage/quota/limit` + `/api/biz/account/query-customer-account-report` | 10 分钟 + 每分钟走字 |
| NAS 状态 | CPU/内存/磁盘卷/Docker 容器存活，离线自动探活恢复 | 飞牛 fnOS 上的 [FNOS-API](https://github.com/heijiangangqin/FNOS-API)（REST :9932） | 10s / 60s |
| 设置 | 卡片开关（即时）/ 语言（即时）/ 时钟样式 / 城市 / GLM Key / NAS 配置 / 恢复自动排列 | localStorage（同 pack 共享） | 即时 |

## 核心机制

- **插件化**：卡片登记在 `pack/shared/cards.js`（纯 JSON 注册表），`python tools/build-pack.py` 据此生成 `zpack.json`。**新增卡片 = 建目录（index.html + app.js）+ 注册表加一行 + 跑构建脚本 + 重启 zebar**
- **共享配置**：同 pack 的 widget 同源共享 localStorage（`dw.config`），设置面板写入后各卡片经 storage 事件 + 3s 轮询双通道热生效
- **动态布局**：`pack/shared/boot.js` 按启用卡片自动堆叠右列（放不下自动换列）；卡片可按住标题行拖动，松手磁吸对齐，位置持久化，设置里可一键恢复自动排列
- **禁用即关闭**：取消勾选的卡片由 boot.js 自关闭，重新勾选立即拉起
- **零外网框架依赖**：zebar 客户端 API 与 solarlunar 农历库均内置本地（`shared/zebar.bundle.js` / `shared/solarlunar.min.js`）

## 目录结构

```
├─ pack/                      ← junction 映射到 ~/.glzr/zebar/decktop
│  ├─ zpack.json              ← 构建产物（勿手改）
│  ├─ config.js               ← 出厂默认值（gitignore，含密钥）
│  ├─ config.example.js       ← 配置模板
│  ├─ shared/
│  │  ├─ cards.js             ← 卡片注册表（插件入口）
│  │  ├─ boot.js              ← 布局/拖动磁吸/配置热更新/多语言/打开卡片
│  │  ├─ i18n.js              ← 中英文字典（加语言=加一个对象）
│  │  ├─ style.css            ← 统一深色毛玻璃样式
│  │  ├─ zebar.bundle.js      ← zebar API 本地打包（esbuild 产物）
│  │  └─ solarlunar.min.js    ← 农历库（ISC，1900-2100）
│  ├─ system/ clock/ calendar/ weather/ glm-balance/ nas/
│  ├─ settings-bar/           ← 列底设置入口细条
│  └─ settings/               ← 设置面板（居中悬浮，380x640）
└─ tools/build-pack.py        ← 注册表 -> zpack.json 构建
```

## 配置

首次使用：复制 `pack/config.example.js` 为 `pack/config.js` 填默认值。日常修改直接用设置面板（点击桌面右下"设置"条）：

- 卡片开关 / 界面语言 / 24 小时制 / 显示秒 —— 即时生效
- 天气城市（保存时经 open-meteo geocoding 自动解析经纬度）
- GLM API Key（`{id}.{secret}`，open.bigmodel.cn）
- NAS：FNOS-API 地址 / Token / 关注容器（逗号分隔，空=全部）

用户设置持久化在 localStorage，优先级高于 config.js；重置方法：设置面板改回，或浏览器 DevTools 清 `dw.config`。

## 构建与更新

```bash
python tools/build-pack.py          # 改注册表/白名单后重新生成 zpack.json
# 重启 zebar：托盘退出 -> 重新打开 -> zebar.exe startup（或勾选开机自启）
```

改动前端文件后若未生效，是 WebView 缓存——把对应 html 里 `?v=N` 版本号 +1。

重建 zebar 本地包（升级 zebar 版本时）：

```bash
npm i zebar @tauri-apps/api esbuild
printf "import * as zebar from 'zebar';\nimport { LogicalPosition, PhysicalPosition } from '@tauri-apps/api/window';\nimport { invoke } from '@tauri-apps/api/core';\nwindow.ZEBAR = Object.assign({}, zebar, { LogicalPosition, PhysicalPosition, rawInvoke: invoke });\n" > entry.mjs
npx esbuild entry.mjs --bundle --minify --format=iife --outfile=../pack/shared/zebar.bundle.js
```

换机器部署：

```bat
mklink /J "%USERPROFILE%\.glzr\zebar\decktop" "<repo>\pack"
```

## 踩坑记录（重要，都是实测踩出来的）

1. **includeFiles 必填**：zpack.json 每个 widget 必须配 `includeFiles` glob 白名单，否则 zebar 资源服务器对所有文件 404。globset 的 `*` 不跨目录，子目录必须 `**/*.js`
2. **自定义 API 走 curl 而非 fetch**：widget 内 fetch 受 CORS 限制；在 `privileges.shellCommands` 声明白名单后用 `zebar.shellExec('C:\\Windows\\System32\\curl.exe', [...])`（绝对路径防 PATH 里 Git 的 curl 抢先）。`argsRegex` 匹配的是**参数数组 join 后的整串**（部分匹配），必须 `^...$` 全串锚定
3. **setPosition 必须用类型对象**：Tauri v2 的 `setPosition` 不接受裸 `{x,y}`，要用 `LogicalPosition`/`PhysicalPosition`（本地包已暴露在 `ZEBAR.LogicalPosition`）
4. **invoke 参数风格不确定**：widget 内调用 `start_widget_preset` 等命令时 camelCase/snake_case 的接受度不稳定，`DW.openWidget()` 内置三级回退（snake → camel → 包装函数）
5. **zebar 资源服务器（127.0.0.1:6124）可能随进程异常挂掉**：所有卡片变"无法访问此页面"时，重启 zebar 进程即恢复
6. **offsetX 方向**：`top_right` 锚点下正值向屏幕外，内缩要写负值
7. **GLM 官方余额接口已下线**：`/api/paas/v4/users/balance_info` 404；可用替代为 `/api/biz/account/query-customer-account-report`（余额）与 `/api/monitor/usage/quota/limit`（额度池，含 5 小时窗口用量与 nextResetTime），API Key 直接 Bearer 无需 JWT
8. **WebView 缓存**：改 js/css 后旧内容可能被缓存，`?v=N` 版本号强制刷新
9. **Tailscale Docker 默认 userspace 网络**（无法被外部主动连接），必须显式 `TS_USERSPACE=false`；`TS_AUTH_ONCE=true` 无 authkey 时会超时退出进入重启循环
10. **FNOS-API**：响应结构为 `{success, data}`；CPU 在 `data.cpu.busy.all`，内存 `data.mem.total/used`，存储 `data.storage/overview` 的 `array[]`（fssize=总量, frsize=空闲），容器 `data.docker/container/ls`（docker API 风格）

## 许可

- solarlunar：ISC License（yize），内置未改动
- 其余代码：随意使用
