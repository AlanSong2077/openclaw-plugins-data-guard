# Data Guard — AI 数据隐私护盾

> 双重防护：① HTTP 代理层在请求离开本机前脱敏所有消息文本；② 工具调用层在 AI 读取 CSV/XLSX/XLS 文件前按列名精准脱敏。纯 Node.js，零外部依赖，数据永不离开本机。

---

## 🛡️ 核心特性

| 特性 | 说明 |
|------|------|
| **双重脱敏层** | HTTP 代理层（消息文本）+ 工具调用层（文件内容） |
| **零外部依赖** | 纯 Node.js 实现，30+ 类脱敏规则全部自研 |
| **零数据离开本机** | 所有处理在本地完成，AI API 仅接收脱敏后数据 |
| **可扩展架构** | 3 行代码即可添加新的文件格式支持 |
| **Fail-Safe** | 脱敏失败时默认阻断请求，不透传原始数据 |
| **子进程隔离** | 代理以独立进程运行，崩溃不影响 OpenClaw Gateway |
| **150+ 测试用例** | 覆盖所有脱敏类型、格式处理器、插件层、代理层 |

---

## 📐 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Layer 5: 插件层 (src/plugins/)                           │  │
│  │  ProxyPlugin        — 注册 HTTP 代理服务                   │  │
│  │  FileDesensitizePlugin — 拦截文件读取工具调用               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Layer 4: 代理层 (src/proxy/)                            │  │
│  │  ProxyServer   — 本地反向代理，拦截并脱敏所有 HTTP 请求     │  │
│  │  UrlRewriter   — 改写 openclaw.json baseUrl，指向本地代理  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Layer 3: 输入层 (src/input/)                            │  │
│  │  FileReader — 读取文件、解析格式、执行脱敏、写临时文件      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Layer 2: 输出层 (src/output/)                           │  │
│  │  TempFileManager — 临时文件生命周期管理                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Layer 1: 核心层 (src/core/)                             │  │
│  │  desensitize.js — 30+ 类脱敏引擎，零外部依赖               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
              ┌───────────────────────────────┐
              │    🌍 AI Provider API         │
              │  (仅接收脱敏后的数据)           │
              └───────────────────────────────┘
```

### 两层互补，无冲突

| 层 | 触发时机 | 原理 | 覆盖范围 |
|---|---------|------|---------|
| **HTTP 代理层** | 所有 `POST /v1/*` 请求 | 本地反向代理，改写 baseUrl 后拦截并脱敏请求体 | 所有消息文本 |
| **工具调用层** | AI 调用 `read`/`read_file`/`read_many_files` | 拦截工具参数，将文件路径替换为脱敏后的临时文件 | CSV / XLSX / XLS 文件内容 |

---

## 🔒 支持的脱敏类型（30+ 类）

### 个人信息

| 类型 | 规则示例 | 脱敏结果示例 |
|------|---------|------------|
| 🇨🇳 大陆手机号 | `13812345678` | `138****5678` |
| 🇭🇰 香港身份证 | `A123456(7)` | `A*******(7)` |
| 🇲🇾 澳门身份证 | `X1234567` | `X******7` |
| 🇹🇼 台湾身份证 | `A123456789` | `A*********` |
| 📄 护照号 | `E12345678` | `E********` |
| 🪪 社保卡号 | `12**************78` | `12**********5678` |
| 🏦 公积金号 | `GJJ123456789012` | `GJJ_56a3c9` |
| 🪪 驾照 | `610***********12` | `610_82c8` |

### 金融账户

| 类型 | 规则示例 | 脱敏结果示例 |
|------|---------|------------|
| 🏛️ 银行卡号（16-19位） | `6222021234567890123` | `6222**********0123` |
| 🆔 统一社会信用代码 | `91110000MA01ABCD2X` | `91***************D2X` |
| 💰 发票号码 | `FP1234567890` | `FP***********` |
| 🧾 合同编号 | `HT2023123456789` | `HT*************` |
| 🛒 订单号/流水号 | `DD2023123456789` | `DD*************` |
| 💳 微信/QQ 号 | `wxid_abcdefghijklm` | `wxid_************lm` |

### 网络身份

| 类型 | 规则示例 | 脱敏结果示例 |
|------|---------|------------|
| 📧 邮箱 | `zhangsan@example.com` | `z***@e******.com` |
| 🌐 IPv4 | `192.168.1.100` | `192.168.*.*` |
| 🌐 IPv6 | `2001:0db8:85a3::8a2e:0370:7334` | `****:****:****:****` |
| 🔐 Token/密钥 | `sk-abcdefghijklmnop123456` | `sk-****************123456` |
| 🔗 URL 敏感参数 | `api_key=abc123&phone=13812345678` | `api_key=****&phone=138****5678` |

### 商业实体

| 类型 | 规则示例 | 脱敏结果示例 |
|------|---------|------------|
| 🏢 企业/集团/基金名称 | `北京阿里巴巴科技有限公司` | `企业_甲公司` |
| 🤝 供应商/客户 | `深圳腾讯云计算有限公司` | `供应商_A` |
| 🏠 部门 | `华东区销售部` | `部门_A` |
| 📋 项目 | `2024年Q4营销 campaign` | `项目_28d7b6` |

### 个人信息（文本）

| 类型 | 规则示例 | 脱敏结果示例 |
|------|---------|------------|
| 👤 姓名 | `张三` | `用户_a1b2` |
| 🏡 地址 | `北京市朝阳区建国路88号` | `北京市朝阳区` + `****88号` |
| 🚗 车牌号 | `京A12345` | `京A***45` |
| 👔 工号 | `EMP2024001234` | `EMP_01abcd` |
| 📅 出生日期 | `1990年5月15日` | `****年5月15日` |
| 💵 金额 | `¥128,888.00` | `¥*元`（随机缩放） |

---

## 📊 CSV 列名精准脱敏

对于结构化文件（CSV/XLSX/XLS），插件根据**列头名称**精准识别敏感列并脱敏：

```csv
# AI 实际拿到的数据（原始版本 AI 永远看不到）
姓名,手机号,身份证号,银行卡号,邮箱,地址,企业名称,部门,工号
张明伟,13812345678,110101199001011234,6222021234567890123,zhangsan@example.com,北京市朝阳区建国路88号,北京阿里巴巴科技有限公司,技术部,EMP2024001
李小红,13987654321,310101198505052345,6222029876543210987,lihong@example.com,上海市浦东新区世纪大道100号,腾讯云计算有限公司,销售部,EMP2024002

# 脱敏后（AI 实际收到的版本）
姓名,手机号,身份证号,银行卡号,邮箱,地址,企业名称,部门,工号
张**,138****5678,1101***********234,6222**********0123,z***@e******.com,北京市朝阳区****88号,企业_甲公司,部门_A,EMP_01abcd
李**,139****4321,3101***********345,6222**********0987,l**@e******.com,上海市浦东新区****100号,企业_乙公司,部门_B,EMP_02efgh
```

### 支持的列名关键词（中英文）

| 敏感类型 | 支持的列名关键词 |
|---------|----------------|
| 手机号 | `mobile`, `phone`, `tel`, `手机`, `电话`, `联系方式` |
| 邮箱 | `email`, `mail`, `邮箱`, `邮件`, `电子邮箱` |
| 姓名 | `name`, `realname`, `username`, `姓名`, `用户名`, `联系人`, `负责人` |
| 身份证号 | `idcard`, `identity`, `身份证`, `证件号` |
| 银行卡号 | `bankcard`, `cardno`, `accountno`, `银行卡`, `卡号`, `账号` |
| 地址 | `address`, `addr`, `地址`, `住址`, `收货地址` |
| 企业名称 | `company`, `org`, `公司`, `企业`, `集团`, `基金` |
| 供应商/客户 | `vendor`, `customer`, `supplier`, `供应商`, `客户`, `甲方`, `乙方` |
| 部门 | `dept`, `department`, `部门`, `事业部`, `团队` |
| 金额 | `amount`, `price`, `salary`, `金额`, `价格`, `薪资`, `收入`, `余额` |
| IP地址 | `ip`, `ipaddress`, `IP`, `服务器IP` |
| 车牌号 | `plate`, `license_plate`, `车牌`, `车牌号` |
| 出生日期 | `birth`, `birthday`, `birthdate`, `出生日期`, `生日` |
| 社保/公积金 | `social`, `housing_fund`, `社保`, `公积金` |
| 工号 | `uid`, `empid`, `employeeid`, `工号`, `员工号` |

---

## 🚀 快速开始

### 安装

```bash
# 方法 1: OpenClaw CLI（推荐）
openclaw plugins install AlanSong2077/openclaw-plugins-data-guard

# 方法 2: 手动安装
npm install -g openclaw-plugins-data-guard

# 方法 3: 从源码安装
git clone https://github.com/AlanSong2077/openclaw-plugins-data-guard.git
cd openclaw-plugins-data-guard
npm install
openclaw plugins install .
```

### 验证安装

```bash
openclaw plugins list
# 应显示: data-guard ✅

openclaw plugins doctor
# 应显示: compatibility advisory 或 config valid
```

### 重启 Gateway

```bash
openclaw gateway restart
# 日志中应看到:
# [data-guard] ✅ 已注册（HTTP 代理层 + 工具调用层双重脱敏）
# [proxy] 🛡️  Data Guard 代理已启动，监听 http://127.0.*.*:47291
# [url-rewriter] openclaw.json 已更新，共改写 N 个 provider
```

---

## ⚙️ 配置

### 插件配置（openclaw.json）

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

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `port` | `47291` | HTTP 代理监听端口 |
| `blockOnFailure` | `true` | 脱敏失败时阻断请求（`false`=透传原文，不推荐） |
| `fileGuard` | `true` | 启用工具调用层文件脱敏 |
| `skipPrefix` | `[skip-guard]` | 消息开头加此前缀可跳过该消息的文本脱敏 |

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATA_GUARD_PORT` | `47291` | 代理监听端口（优先级高于配置） |
| `DATA_GUARD_BLOCK_ON_FAILURE` | `true` | 失败时阻断或透传 |
| `OPENCLAW_DIR` | `~/.openclaw` | OpenClaw 配置目录（Windows 自动检测） |

---

## 🎯 使用场景

### 场景 1：金融投研 — 客户数据分析

```csv
# 原始数据（AI 永远看不到）
客户姓名,交易账号,身份证号,手机号,开户行,账户余额,企业名称
李明,6222021234567890123,110101199001011234,13812345678,工商银行,¥603,750.00,北京华泰证券股份有限公司

# 脱敏后（AI 实际收到的版本）
客户姓名,交易账号,身份证号,手机号,开户行,账户余额,企业名称
李**,6222**********0123,1101***********234,138****5678,工商银行,¥603,750.00,企业_甲公司
```

### 场景 2：医疗数据 — 患者记录分析

```csv
# 原始数据（AI 永远看不到）
姓名,病历号,身份证号,手机号,诊断结果,处方药物,家庭住址
王芳,BL2023456789,310101198505052345,13987654321,2型糖尿病,二甲双胍500mg tid,北京市朝阳区建国路88号1号楼201

# 脱敏后（AI 实际收到的版本）
姓名,病历号,身份证号,手机号,诊断结果,处方药物,家庭住址
王*,BL_78a2f1,3101***********345,139****4321,2型糖尿病,二甲双胍500mg tid,北京市朝阳区****88号1号楼201
```

### 场景 3：HR — 薪资与员工信息

```csv
# 原始数据（AI 永远看不到）
工号,姓名,部门,入职日期,基本工资,手机号,邮箱,银行卡号
EMP2024001,张明伟,技术部,2020-03-15,¥35,000,13812345678,zhangsan@company.com,6222021234567890123

# 脱敏后（AI 实际收到的版本）
工号,姓名,部门,入职日期,基本工资,手机号,邮箱,银行卡号
EMP_01abcd,张**,部门_A,2020-03-15,¥*,000,138****5678,z**@c****y.com,6222**********0123
```

### 场景 4：法律文书 — 合同审查

```csv
# 原始数据（AI 永远看不到）
甲方,身份证号,联系电话,银行账号,地址,签署日期,企业名称
张总,120101197001011234,13987654321,6222029876543210987,天津市和平区南京路200号,2024-01-15,北京华润集团有限公司

# 脱敏后（AI 实际收到的版本）
甲方,身份证号,联系电话,银行账号,地址,签署日期,企业名称
张*,1201***********234,139****4321,6222**********0987,天津市和平区****200号,2024-01-15,企业_甲公司
```

---

## 🧪 测试

```bash
# 运行全部测试（150+ 用例）
npm test

# 只跑核心脱敏引擎测试
npm run test:core

# 只跑格式处理器测试
npm run test:formats

# 只跑 HTTP 代理测试
npm run test:proxy

# 遇到第一个失败就停止
npm run test:bail
```

测试输出示例：

```
▶ core › desensitize() 各类敏感信息
  ✓ 手机号被脱敏 (2ms)
  ✓ 邮箱被脱敏 (1ms)
  ✓ 身份证被脱敏 (2ms)
  ✓ 银行卡被脱敏 (1ms)
  ✓ IP地址被脱敏 (1ms)
  ✓ Token/密钥被脱敏 (2ms)
  ✓ URL敏感参数被脱敏 (1ms)
  ✓ 混合敏感信息全部被脱敏 (3ms)
  ✓ 干净文本不被修改 (0ms)
  ✓ 金额被脱敏（数值缩放） (1ms)
  ✓ 地址被脱敏 (1ms)
  ✓ 企业名称被脱敏 (1ms)
  ✓ CSV 格式文本走列名精准脱敏 (2ms)
  ✓ 干净 CSV 不被修改 (0ms)

▶ core › makeCtx 上下文隔离
  ✓ 同一 ctx 内同名映射一致 (0ms)
  ✓ 不同 ctx 之间互不影响 (0ms)
  ✓ 供应商按字母顺序编号 (0ms)
  ✓ 部门按字母顺序编号 (0ms)

▶ core › findColRule() 列名匹配
  ✓ "手机" → 手机号 (0ms)
  ✓ "mobile" → 手机号 (0ms)
  ✓ "邮箱" → 邮箱 (0ms)
  ✓ "email" → 邮箱 (0ms)
  ✓ "姓名" → 姓名 (0ms)
  ✓ ... (60+ 列名匹配测试)

────────────────────────────────────────────────────────────
结果  ✅ 152 通过    共 152 个，耗时 28ms
```

---

## 📁 项目结构（v2.0.3）

```
openclaw-plugins-data-guard/
├── index.js                              # 插件注册入口（串联各层）
├── openclaw.plugin.json                  # Plugin manifest（configSchema、uiHints）
├── package.json
│
├── src/
│   ├── core/
│   │   └── desensitize.js               # ⭐ 脱敏引擎（30+ 类规则，零依赖）
│   │       ├── maskPhone / maskEmail / maskIdCard / maskBank
│   │       ├── maskName / maskCompany / maskVendor / maskDept
│   │       ├── maskAddress / maskAmount / maskLicensePlate
│   │       ├── maskContract / maskOrder / maskInvoice
│   │       ├── maskEmployeeId / maskHousingFund / maskSocialSecurity
│   │       ├── maskToken / maskIp / maskUrlParam
│   │       ├── CSV_COLUMN_RULES          # 列名 → 脱敏函数 映射表
│   │       ├── findColRule()             # 根据列名查找脱敏规则
│   │       └── desensitize() / mightContainSensitiveData()
│   │
│   ├── input/
│   │   └── FileReader.js                 # 读取文件 → 解析 → 脱敏 → 写临时文件
│   │
│   ├── output/
│   │   └── TempFileManager.js           # 临时文件生命周期管理
│   │
│   ├── proxy/
│   │   ├── ProxyServer.js               # HTTP 反向代理（可独立运行）
│   │   ├── UrlRewriter.js               # 改写 openclaw.json baseUrl
│   │   └── proxy-process.js             # 代理子进程入口
│   │
│   └── plugins/
│       ├── base/
│       │   ├── Plugin.js                # 插件抽象基类
│       │   └── ToolPlugin.js            # 工具调用插件基类
│       ├── ProxyPlugin.js               # HTTP 代理插件（registerService）
│       └── tool/
│           ├── FileDesensitizePlugin.js # 文件脱敏插件（before_tool_call）
│           └── formats/
│               ├── FileFormat.js        # 格式处理器抽象基类 + 注册表
│               ├── CsvFormat.js         # CSV 格式处理器
│               ├── XlsxFormat.js        # XLSX 格式处理器
│               ├── XlsFormat.js         # XLS 格式处理器
│               └── index.js             # 格式注册入口
│
└── test/                               # 150+ 测试用例
    ├── runner.js                        # 零依赖测试框架
    ├── index.js                         # 测试入口
    ├── core.test.js                     # 核心脱敏引擎测试
    ├── input.test.js                    # 文件读取测试
    ├── output.test.js                   # 临时文件管理测试
    ├── plugins.test.js                  # 插件层测试
    ├── formats.test.js                  # 格式处理器测试
    ├── proxy.test.js                    # HTTP 代理测试
    └── fixtures/
        └── index.js                     # 测试数据（敏感文本/干净文本）
```

---

## 🔌 扩展开发

### 添加新的文件格式（3 行代码）

```js
// 1. 继承 FileFormat 基类
import { FileFormat } from './plugins/tool/formats/FileFormat.js'

class PdfFormat extends FileFormat {
  get extensions() { return ['.pdf'] }
  parse(buffer) {
    // 解析 PDF，返回 { rows: [['列1', '列2'], ...] }
    // 如果 PDF 无法解析为表格结构，返回 null（跳过脱敏）
    return null
  }
  getRows(sheet) { return sheet.rows }
}

// 2. 注册到全局 registry
import { registry } from './plugins/tool/formats/index.js'
registry.register(new PdfFormat())

// 3. 完成！FileDesensitizePlugin 会自动识别并处理 .pdf 文件
```

### 创建新的工具调用拦截插件

```js
import { ToolPlugin } from './plugins/base/ToolPlugin.js'

class HttpRequestPlugin extends ToolPlugin {
  get id()           { return 'http-request-guard' }
  get name()         { return 'HTTP 请求脱敏' }
  get supportedTools() { return ['http_request', 'fetch', 'curl'] }

  handleToolCall(toolName, params, config, logger) {
    // params 中可能包含 URL、headers、body 等
    // 返回修改后的 params，或 undefined 表示不处理
    if (params.url) {
      params.url = desensitizeUrl(params.url)
    }
    return { params }
  }
}
```

### 独立使用 ProxyServer（不依赖 OpenClaw）

```js
import { ProxyServer } from './proxy/ProxyServer.js'

const proxy = new ProxyServer({
  port: 47291,
  blockOnFailure: true,
  logFile: './proxy.log',
})

await proxy.start()
console.log('Proxy running on http://127.0.*.*:47291')

// 配合 UrlRewriter 改写目标服务的 baseUrl
import { syncBaseUrls } from './proxy/UrlRewriter.js'
syncBaseUrls('./openclaw.json', 47291, logger)
```

---

## 🔍 故障排查

### 端口被占用

```bash
# 查看端口占用
lsof -i :47291

# 终止占用进程
kill -9 <PID>

# 或修改端口（见配置章节）
```

### 插件未加载

```bash
# 诊断
openclaw plugins doctor

# 重装
openclaw plugins uninstall data-guard
openclaw plugins install AlanSong2077/openclaw-plugins-data-guard
```

### 脱敏未生效

```bash
# 查看代理日志
cat ~/.openclaw/data-guard/proxy.log

# 最近 20 条
tail -20 ~/.openclaw/data-guard/proxy.log

# 检查 openclaw.json 是否已改写 baseUrl
grep -A2 '"baseUrl"' ~/.openclaw/openclaw.json
```

### 测试失败

```bash
# 详细输出
npm run test:bail

# 只跑核心测试
npm run test:core
```

---

## 📈 版本历史

### v2.0.3 (2026-04-03)
- 🧪 新增完整测试套件（150+ 测试用例）
- 🏗️ 重构为 5 层架构（core/input/output/proxy/plugins）
- 🔧 新增 CSV_COLUMN_RULES 导出供外部复用
- 📝 更新 README，添加所有 30+ 脱敏类型详细说明
- 🐛 修复多项 bug

### v2.0.2
- 🆕 支持港澳台身份证、驾照、社保卡、公积金号
- ✅ 添加 Luhn 校验防止误报银行卡号
- 📝 新增 10 位座机号支持

### v2.0.1
- ✨ 支持 CSV 列名精准脱敏（24 类列名规则）
- 🆕 新增企业/集团/基金名称、供应商/客户、部门、项目脱敏
- 📝 添加金额、出生日期、年龄、车牌号、工号脱敏

### v2.0.0
- 🔄 全新双层架构（HTTP 代理层 + 工具调用层）
- 🆕 30+ 类敏感信息脱敏规则
- ⚡ 零外部依赖，纯 Node.js 实现

---

## 🙏 致谢

- **keyuzhang838-dotcom** — 贡献了 Hook Plugins 模块
- 所有测试用例贡献者

---

## 📄 License

MIT License

---

## 👥 作者

- **Alan Song**
- **Roxy Li**
