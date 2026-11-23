# -*- coding: utf-8 -*-
"""从 pack/shared/cards.js 注册表生成 pack/zpack.json。

新增卡片：在 cards.js 登记一行 -> python tools/build-pack.py -> 重启 zebar。
"""
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS_JS = os.path.join(ROOT, 'pack', 'shared', 'cards.js')
ZPACK = os.path.join(ROOT, 'pack', 'zpack.json')

# curl 命令白名单模板（与卡片 app.js 中的调用方式保持一致）
SHELL_TEMPLATES = {
    'glm': {
        'program': 'C:\\Windows\\System32\\curl.exe',
        'argsRegex': (
            '^-s -m [0-9]+ -H Authorization: Bearer [A-Za-z0-9._-]+ '
            'https://open\\.bigmodel\\.cn/api/'
            '(biz/account/query-customer-account-report|monitor/usage/quota/limit)$'
        ),
    },
    # 天气走和风天气（国内直连；curl 带 API Key 头避免 CORS）
    'weather': {
        'program': 'C:\Windows\System32\curl.exe',
        'argsRegex': (
            '^-s -4 -m [0-9]+ -H X-QW-Api-Key: [A-Za-z0-9]{8,64} '
            '(https://geoapi\.qweather\.com/v2/city/lookup\?location=[^&]+&number=1'
            '|https://devapi\.qweather\.com/v7/weather/(now|7d)\?location=[A-Za-z0-9]{2,20})$'
        ),
    },
    'nas': {
        'program': 'C:\\Windows\\System32\\curl.exe',
        # 支持主机名与 https（外网经 Lucky/Tailscale 反代时使用）
        'argsRegex': (
            '^-s -m [0-9]+ -H Authorization: Bearer \\S+ '
            'https?://[a-zA-Z0-9.-]+:9932/api/[a-zA-Z0-9/_-]+$'
        ),
    },
}

TOP = 16
GAP = 12


def load_registry():
    with io.open(CARDS_JS, encoding='utf-8') as f:
        text = f.read()
    m = re.search(r'window\.DW_CARDS\s*=\s*(\[.*?\]);', text, re.S)
    if not m:
        raise SystemExit('cards.js 里找不到 DW_CARDS 数组')
    return json.loads(m.group(1))


def build():
    cards = load_registry()
    widgets = []
    y = TOP
    for card in cards:
        is_panel = card.get('stack') is False
        height = card['height']

        widget = {
            'name': card['name'],
            'htmlPath': '%s/index.html' % card['name'],
            'zOrder': 'normal' if is_panel else 'bottom_most',
            'shownInTaskbar': False,
            'focused': bool(is_panel),
            'resizable': False,
            'transparent': True,
            'presets': [{
                'name': 'default',
                'anchor': 'top_right',
                'offsetX': '-16px',
                # 默认预设位置：全启用时的堆叠位置（面板固定在顶部）；
                # 实际位置由 shared/boot.js 按启用情况动态计算
                'offsetY': '%dpx' % (TOP if is_panel else y),
                'width': '380px' if is_panel else '340px',
                'height': '%dpx' % height,
                'monitorSelection': {'type': 'primary'},
            }],
            'includeFiles': ['*.js', '*.png', '**/*.html', '**/*.css', '**/*.js', '**/*.png'],
        }
        if card.get('shell'):
            widget['privileges'] = {
                'shellCommands': [dict(SHELL_TEMPLATES[card['shell']])]
            }
        widgets.append(widget)

        if not is_panel:
            y += height + GAP

    pack = {
        '$schema': 'https://raw.githubusercontent.com/glzr-io/zebar/main/resources/zpack-schema.json',
        'name': 'decktop',
        'version': '0.2.0',
        'description': '桌面小组件套件：本机状态/时钟农历/日历/天气7天/GLM Code Plan 用量/NAS 监控，'
                       '插件化卡片 + 可视化设置（中英双语），卡片可拖动磁吸排列',
        'tags': ['dashboard', 'clock', 'calendar', 'weather', 'monitor', 'chinese'],
        'previewImages': ['./resources/preview-1.png'],
        'repositoryUrl': 'https://github.com/zhoujarvy/decktop',
        'widgets': widgets,
    }

    with io.open(ZPACK, 'w', encoding='utf-8') as f:
        json.dump(pack, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print('zpack.json 已生成，共 %d 个 widget：%s' % (
        len(widgets), ', '.join(w['name'] for w in widgets)))


if __name__ == '__main__':
    build()
