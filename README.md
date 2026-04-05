<p align="center">
  <img src="https://img.freepik.com/free-vector/security-concept-illustration_114360-060.jpg?w=1200" width="100%" alt="Data Guard Banner"/>
</p>

<h1 align="center">
  🔒 Data Guard
</h1>

<p align="center">
  <strong>Dual-layer data desensitization plugin for OpenClaw</strong>
  <br>
  Sensitive data is sanitized locally — before it ever reaches an AI API
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.6-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Plugin_ID-data--guard-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Engine-Pure_Node.js--zero_deps-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Platform-macOS_Linux_Windows-black?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" />
</p>

---

## 🎯 Overview

**Data Guard** intercepts outbound AI requests at **two independent layers** — an HTTP proxy and a tool hook — ensuring that personal and sensitive information is masked on your machine **before** being sent upstream.

| | |
|---|---|
| Version | 2.0.6 |
| Plugin ID | `data-guard` |
| Engine | Pure Node.js — zero external dependencies |
| Platform | macOS · Linux · Windows |
| License | MIT |

---

## ⚡ How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Machine                               │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              OpenClaw Gateway                              │  │
│   │                                                            │  │
│   │   Layer 2 — Tool Hook                                     │  │
│   │   ┌─────────────────────────────────────────────────┐    │  │
│   │   │ read / read_file / read_many_files               │    │  │
│   │   │ Sanitizes CSV/XLSX/XLS/DOCX/PPTX/PDF             │    │  │
│   │   │ Column-level precision for structured files        │    │  │
│   │   └─────────────────────────────────────────────────┘    │  │
│   │                                                            │  │
│   │   Layer 1 — HTTP Proxy (port 47291)                      │  │
│   │   ┌─────────────────────────────────────────────────┐    │  │
│   │   │ Intercepts all POST /v1/* requests              │    │  │
│   │   │ Sanitizes request body before forwarding         │    │  │
│   │   └─────────────────────────────────────────────────┘    │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    sanitized only
                              ▼
                      ┌───────────────┐
                      │  AI Provider  │
                      │     API       │
                      └───────────────┘
```

| Layer | Trigger | What it covers |
|:------|:--------|:---------------|
| 🅛 **L1: HTTP Proxy** | Every outbound API call | All message text sent to the model |
| 🅐 **L2: Tool Hook** | `read`, `read_file`, `read_many_files` | CSV / XLSX / XLS / DOCX / PPTX / PDF file contents |

---

## 🛡️ Supported Data Types

**30+ categories** of sensitive data are recognized and masked:

| Category | Example Input | Masked Output |
|:---------|:--------------|:--------------|
| 📱 Phone number | `138****5678` | `138****5678` |
| 🆔 Chinese ID | `110***********1234` | `1101***********1234` |
| 💳 Bank card | `单号_92b6fedb` | `6222**********0123` |
| 📧 Email | `u**r@example.com` | `u***r*@example.com` |
| 🛂 Passport | `E****678` | `E********` |
| 🌐 IPv4 / IPv6 | `192.168.*.*` | `192.168.*.*` |
| 🧾 Tax / credit code | `91**************2G` | `91**************2G` |
| 🧾 Invoice number | `FP1234567890` | `FP***********` |
| 🔢 Order / transaction ID | `DD2023123456789` | `DD*************` |
| 🏛️ Social security | `12**************78` | `**************5678` |
| 👤 Name | `张明伟` | `用户_a3f2` |
| 🏠 Address | `北京市朝阳区建国路88号` | `北京市朝阳区***` |
| 🔐 Token / password | `Bearer********` | `Bearer ********` |
| 💬 WeChat / QQ ID | `wx_abc123` | `wx_****` |
| 🚗 Vehicle plate | `京A·12345` | `京A·***45` |
| 💰 Amount (scaled) | `¥352885.8` | `¥264664.35` (random scale) |
| ➕ **and more…** | | |

### Column-level Precision

When reading CSV or Excel files, Data Guard identifies sensitive columns by **header name** and applies the appropriate mask — not a blanket regex.

```
┌─────────────────────────────────────────────────────────────┐
│  Input (AI never sees this)                                  │
├─────────────────────────────────────────────────────────────┤
│  姓名,手机号,身份证号,银行卡号,邮箱                          │
│  张明伟,138****5678,110***********1234,单号_92b6fedb,u***r*@example.com │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Output (what the AI receives)                               │
├─────────────────────────────────────────────────────────────┤
│  姓名,手机号,身份证号,银行卡号,邮箱                          │
│  用户_a3f2,138****5678,1101***********1234,6222**********0123,z***g*@example.com │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

```bash
# 1. Clone and pack
git clone https://github.com/AlanSong2077/openclaw-plugins-data-guard.git
cd openclaw-plugins-data-guard
npm pack

# 2. Install into OpenClaw
openclaw plugins install data-guard-2.0.6.tgz

# 3. Restart the gateway
openclaw gateway restart

# 4. Verify
openclaw plugins list
# data-guard   loaded   2.0.6 ✅
```

---

## ⚙️ Configuration

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `port` | integer | `47291` | Port the local HTTP proxy listens on |
| `blockOnFailure` | boolean | `true` | Block request if desensitization fails |
| `fileGuard` | boolean | `true` | Enable Layer 2 file desensitization |
| `skipPrefix` | string | `[skip-guard]` | Prepend to bypass text desensitization |

### Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `DATA_GUARD_PORT` | `47291` | Proxy port (overrides plugin config) |
| `DATA_GUARD_BLOCK_ON_FAILURE` | `true` | Fail-safe mode |

---

## 🔄 Orphan Process Protection

The proxy runs as a **child process** of the gateway. Two mechanisms ensure it never becomes orphaned:

| Mechanism | Side | Description |
|:----------|:-----|:------------|
| ❤️ **Heartbeat** | Proxy | Every 5s checks parent via `process.kill(ppid, 0)`. Shuts down if parent is gone. |
| 🧹 **PID Cleanup** | Plugin | On every `start()`, kills stale process before spawning new one. |

---

## ⏭️ Skipping Desensitization

To send a message **without** text desensitization (Layer 1), prefix it with `[skip-guard]` (configurable):

```
[skip-guard] This message goes through without masking.
```

> ⚠️ Layer 2 file desensitization is **unaffected** by this prefix.

---

## 🏗️ Project Structure

```
data-guard/
│
├── index.js                          # Plugin entry — wires all layers together
├── openclaw.plugin.json              # Plugin manifest
├── package.json
├── data-guard-2.0.6.tgz             # Pre-built package
│
└── src/
    ├── core/
    │   └── desensitize.js            # Desensitization engine (30+ rules, zero deps)
    │
    ├── input/
    │   └── FileReader.js             # Reads file → parses → desensitizes → temp file
    │
    ├── output/
    │   └── TempFileManager.js        # Temp file lifecycle management
    │
    ├── proxy/
    │   ├── ProxyServer.js            # HTTP reverse proxy server
    │   ├── UrlRewriter.js            # Rewrites provider baseUrls in openclaw.json
    │   └── proxy-process.js          # Proxy child process entry point
    │
    └── plugins/
        ├── base/
        │   ├── Plugin.js              # Abstract base class for all plugins
        │   └── ToolPlugin.js          # Base class for tool-hook plugins
        │
        ├── ProxyPlugin.js             # HTTP proxy plugin (registerService)
        │
        └── tool/
            ├── FileDesensitizePlugin.js
            └── formats/
                ├── FileFormat.js      # Abstract format + registry
                ├── CsvFormat.js
                ├── XlsxFormat.js
                ├── XlsFormat.js
                ├── DocxFormat.js     # DOCX / DOTX (ZIP + XML, zero deps)
                ├── PptxFormat.js     # PPTX / POTX (ZIP + XML, zero deps)
                ├── PdfFormat.js       # PDF (content stream extraction, zero deps)
                └── index.js
```

---

## 🛠️ Extending Data Guard

### Adding a new file format

```js
import { FileFormat } from 'data-guard/plugins/tool/formats/FileFormat'
import { registry }   from 'data-guard/plugins/tool/formats'

class OdsFormat extends FileFormat {
  get extensions() { return ['.ods'] }
  parse(buffer)    { /* return { sheets: [{ name, rows }] } */ }
}

registry.register(new OdsFormat())
// FileDesensitizePlugin will automatically handle .ods files
```

### Adding a new tool plugin

```js
import { ToolPlugin } from 'data-guard/plugins/base/ToolPlugin'

class MyPlugin extends ToolPlugin {
  get id()             { return 'my-plugin' }
  get name()           { return 'My Plugin' }
  get supportedTools() { return ['my_tool'] }

  handleToolCall(toolName, params, config, logger) {
    // return { params: modifiedParams } or undefined to pass through
  }
}
```

---

## 🔧 Troubleshooting

**Port 47291 already in use**
```bash
# This should not happen in v2.0.6 — automatic cleanup is built-in
lsof -i :47291        # find the process
kill <PID>            # kill it
openclaw gateway restart
```

**Plugin not loading**
```bash
openclaw plugins list
openclaw plugins uninstall data-guard --force
openclaw plugins install data-guard-2.0.6.tgz
openclaw gateway restart
```

**Check proxy logs**
```bash
tail -f ~/.openclaw/data-guard/proxy.log
```

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first to discuss significant changes.

---

## 👥 Authors

| | |
|:--|:--|
| **Alan Song** | Lead Developer |
| **Roxy Li** | Contributor |

---

## 🙏 Acknowledgements

- **keyuzhang838-dotcom** — contributed the Hook Plugins module

---

## 📄 License

MIT License

---

<p align="center">
  <strong>🛡️ Your data stays on your machine — always</strong>
  <br><br>
  <img src="https://img.shields.io/badge/OpenClaw-Plugin-blueviolet?style=for-the-badge&logo=robot" />
  <img src="https://img.shields.io/badge/Node.js-Pure_JS-green?style=for-the-badge&logo=nodedotjs" />
  <img src="https://img.shields.io/badge/Zero_Dependencies-green?style=for-the-badge&logo=package" />
</p>

<p align="center">
  <sub>Built for privacy · Designed for security</sub>
</p>
