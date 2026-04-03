# Data Guard

> AI 数据隐私护盾 | Dual-layer data desensitization for OpenClaw

双重防护：HTTP 代理层拦截消息文本 + 工具调用层拦截文件内容。纯 Node.js，零外部依赖，数据不离开本机。

---

## 特性 | Features

| | |
|---|---|
| 🛡️ **双重脱敏层** | HTTP 代理层（所有 `POST /v1/*`） + 工具调用层（CSV/XLSX/XLS 文件） |
| 🔒 **30+ 敏感类型** | 手机号、身份证、银行卡、邮箱、IP、Token、姓名、企业名称、地址、金额... |
| 📊 **CSV 列名精准脱敏** | 根据列头名称自动识别并脱敏 24 类敏感列 |
| ⚡ **零外部依赖** | 纯 Node.js 实现，全部自研 |
| 🔒 **Fail-Safe** | 脱敏失败默认阻断，不透传原始数据 |
| 🧪 **150+ 测试用例** | 覆盖所有脱敏类型、格式处理器、插件层、代理层 |

---

## 架构 | Architecture

```
OpenClaw → ProxyServer (127.0.*.*:47291) → AI Provider API
               ↑
         拦截所有 HTTP 请求
         递归脱敏 request body
```

| 层 Layer | 触发 Trigger | 机制 Mechanism | 覆盖 Coverage |
|---|---|---|---|
| HTTP 代理层 | `POST /v1/*` | 本地反向代理，改写 baseUrl 后拦截请求体 | 所有消息文本 |
| 工具调用层 | `read`/`read_file` | 拦截工具参数，替换为脱敏后的临时文件 | CSV/XLSX/XLS |

---

## 支持的脱敏类型 | Supported Types

| 类型 Type | 规则 Rule | 示例 Example |
|---|---|---|
| 🇨🇳 手机号 | `1[3-9]\d{9}` | `138****5678` → `138****5678` |
| 🪪 身份证号 | 18位大陆/港澳台/护照 | `1101***99****11234` → `1101***********1234` |
| 🏦 银行卡 | 16-19位 + Luhn校验 | `6222***********0123` → `6222**********0123` |
| 📧 邮箱 | Standard format | `z***g@example.com` → `z**@e******.com` |
| 🌐 IP地址 | IPv4 / IPv6 | `192.168.*.*` → `192.168.*.*` |
| 🔐 Token/密钥 | `sk-`/`api_key` 等 | `sk-abcdefgh...` → `sk-****************123456` |
| 👤 姓名 | 上下文感知映射 | `张三` → `用户_a1b2`（同 ctx 内一致） |
| 🏢 企业/集团/基金 | 60+ 后缀词 + 前缀词 | `某某科技有限公司` → `企业_甲公司` |
| 🤝 供应商/客户 | 字母顺序编号 | `A公司` → `供应商_A` |
| 🏠 部门 | 字母顺序编号 | `销售部` → `部门_A` |
| 📍 地址 | 省市保留，详细地址脱敏 | `北京市朝阳区建国路88号` → `北京市朝阳区****88号` |
| 💰 金额 | 随机缩放（0.3-0.7x） | `¥128,888` → `¥*元` |
| 🚗 车牌号 | 保留省市和字母 | `京A12345` → `京A***45` |
| 📅 出生日期 | 精确到年月 | `1990年5月15日` → `****年5月15日` |
| 🪪 社保/公积金 | 6位 hash | `GJJ1234567890` → `GJJ_56a3c9` |
| 👔 工号 | 6位 hash | `EMP2024001` → `EMP_01abcd` |
| 🛒 订单/流水号 | 前缀保留 | `DD2023123456789` → `DD*************` |
| 🧾 发票/合同号 | 前缀保留 | `HT2023xxxx` → `HT*************` |
| 💳 微信/QQ号 | 保留前缀 | `wxid_abcdefghijklm` → `wxid_************lm` |

### CSV 列名精准脱敏 | CSV Column-Level Rules

```csv
# 输入（AI 看不到原始数据）
姓名,手机号,身份证号,银行卡号,邮箱,地址
张明伟,13812345678,110101199001011234,62220212345678900123,zhangsan@example.com,北京市朝阳区建国路88号

# 输出（AI 收到的脱敏数据）
姓名,手机号,身份证号,银行卡号,邮箱,地址
张**,138****5678,1101***********1234,6222**********0123,z**@e******.com,北京市朝阳区****88号
```

---

## 快速开始 | Quick Start

```bash
# 安装
openclaw plugins install AlanSong2077/openclaw-plugins-data-guard

# 验证
openclaw plugins list | grep data-guard

# 重启 Gateway
openclaw gateway restart
```

安装后自动完成：
1. 启动本地 HTTP 代理（默认端口 `47291`）
2. 改写 `openclaw.json` 中所有 provider 的 `baseUrl`
3. 注册文件脱敏工具钩子

---

## 配置 | Configuration

```json
{
  "plugins": {
    "entries": {
      "data-guard": {
        "enabled": true,
        "config": {
          "port": 47291,
          "blockOnFailure": true,
          "fileGuard": true,
          "skipPrefix": "[skip-guard]"
        }
      }
    }
  }
}
```

| 配置 Config | 默认 Default | 说明 Description |
|---|---|---|
| `port` | `47291` | HTTP 代理监听端口 |
| `blockOnFailure` | `true` | 脱敏失败时阻断请求（`false`=透传） |
| `fileGuard` | `true` | 启用文件脱敏（CSV/XLSX/XLS） |
| `skipPrefix` | `[skip-guard]` | 消息加此前缀可跳过该条文本脱敏 |

---

## 扩展 | Extension

### 添加新文件格式（3 行代码）

```js
import { FileFormat, registry } from './plugins/tool/formats/index.js'

class PdfFormat extends FileFormat {
  get extensions() { return ['.pdf'] }
  parse(buffer) { /* 解析 PDF，返回 { rows } 或 null */ }
}

registry.register(new PdfFormat())
```

### 独立使用 ProxyServer

```js
import { ProxyServer } from './proxy/ProxyServer.js'
import { syncBaseUrls } from './proxy/UrlRewriter.js'

const proxy = new ProxyServer({ port: 47291, blockOnFailure: true })
await proxy.start()

// 改写 openclaw.json baseUrl
syncBaseUrls('./openclaw.json', 47291, logger)
```

---

## 测试 | Testing

```bash
npm test          # 全部测试（150+ 用例）
npm run test:core # 核心脱敏引擎
npm run test:bail # 遇错即停
```

---

## 项目结构 | Structure

```
src/
├── core/desensitize.js        # 脱敏引擎（30+ 规则，零依赖）
├── input/FileReader.js        # 文件读取 → 解析 → 脱敏 → 临时文件
├── output/TempFileManager.js   # 临时文件生命周期管理
├── proxy/
│   ├── ProxyServer.js         # HTTP 反向代理
│   ├── UrlRewriter.js         # openclaw.json baseUrl 改写
│   └── proxy-process.js       # 子进程入口
└── plugins/
    ├── ProxyPlugin.js          # 代理服务注册
    ├── base/Plugin.js          # 插件基类
    └── tool/
        ├── FileDesensitizePlugin.js  # 文件脱敏插件
        └── formats/            # CSV / XLSX / XLS 格式处理器
```

---

## 故障排查 | Troubleshooting

```bash
# 端口占用
lsof -i :47291
kill -9 <PID>

# 诊断
openclaw plugins doctor

# 查看代理日志
cat ~/.openclaw/data-guard/proxy.log
grep "已脱敏" ~/.openclaw/data-guard/proxy.log
```

---

## 版本历史 | Changelog

### v2.0.3
- 🧪 完整测试套件（150+ 测试用例）
- 🏗️ 重构为 5 层架构
- 📝 重写 README

### v2.0.2
- 🆕 港澳台身份证、驾照、社保卡、公积金号
- ✅ Luhn 校验防误报

### v2.0.1
- ✨ CSV 列名精准脱敏（24 类列名规则）
- 🆕 企业/供应商/部门/项目/金额/车牌/工号脱敏

---

## 🙏 致谢 | Acknowledgements

- **keyuzhang838-dotcom** — Hook Plugins 模块贡献

---

## 📄 License

MIT
