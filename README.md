<p align="center">
  <img src="https://img.freepik.com/free-vector/security-concept-illustration_114360-060.jpg?w=1200" width="100%" alt="Data Guard Banner"/>
</p>

<h1 align="center">
  🔒 Data Guard
</h1>

<p align="center">
  <strong>Four-layer data desensitization plugin for OpenClaw</strong>
  <br>
  Sensitive data is encrypted locally — before it ever reaches an AI API
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.3.1-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Plugin_ID-data--guard-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Engine-Pure_Node.js--zero_deps-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-red?style=flat-square" />
  <img src="https://img.shields.io/badge/Platform-macOS_Linux_Windows-black?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" />
</p>

---

## 🎯 Overview

**Data Guard** intercepts outbound AI requests at **four independent layers** — an HTTP proxy, a file tool hook, a Python exec hook, and a Shell exec hook — ensuring that personal and sensitive information is protected on your machine **before** being sent upstream.

Starting from v2.3.0, Data Guard introduces a **Reversible Encryption Mode** (AES-256-GCM) alongside the classic block mode. Sensitive values are replaced with opaque tokens before reaching the LLM, then seamlessly decrypted in the response — so the AI never sees raw PII, but the user always gets a coherent answer.

| | |
|---|---|
| Version | 2.3.1 |
| Plugin ID | `data-guard` |
| Engine | Pure Node.js — zero external dependencies |
| Encryption | AES-256-GCM (reversible mode) |
| Platform | macOS · Linux · Windows |
| License | MIT |

---

## ⚡ How It Works

### Block Mode (default)

```
User Input ──► [Proxy] detect PII ──► 403 Blocked
                                       ↑
                              request never leaves machine
```

### Reversible Mode (v2.3.0+)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Your Machine                                │
│                                                                      │
│  User: "手机号13812345678，邮箱zhangsan@example.com"                 │
│                    │                                                 │
│                    ▼                                                 │
│         ┌─────────────────────┐                                     │
│         │  UnifiedEncryption  │  AES-256-GCM per value              │
│         │       Guard         │                                     │
│         └─────────────────────┘                                     │
│                    │                                                 │
│   13812345678  ──► <ENC>PHONE_1775833254949_1</ENC>                 │
│   zhangsan@…   ──► <ENC>EMAIL_1775833254949_0</ENC>                 │
│                    │                                                 │
│                    ▼                                                 │
│         ┌─────────────────────┐                                     │
│         │   HTTP Proxy :47291 │ ──────────────────────────────────► │
│         └─────────────────────┘                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                                    │
                                          tokens only (no raw PII)
                                                    ▼
                                         ┌──────────────────┐
                                         │   AI Provider    │
                                         │  sees <ENC>...   │
                                         └──────────────────┘
                                                    │
                                          response with tokens
                                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Proxy decrypts tokens back to original values                       │
│  <ENC>PHONE_...> ──► 13812345678                                    │
│  <ENC>EMAIL_...> ──► zhangsan@example.com                           │
│                    │                                                 │
│                    ▼                                                 │
│  User sees complete, coherent response ✅                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Four Protection Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│                       OpenClaw Gateway                                │
│                                                                       │
│  Layer 4 — Shell Exec Hook                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ cat / head / awk / node / Rscript / bash …                   │   │
│  │ Intercepts file reads inside shell commands                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Layer 3 — Python Exec Hook                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ exec / process tool calls running Python                      │   │
│  │ Intercepts open() / read() inside Python scripts              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Layer 2 — File Tool Hook                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ read / read_file / read_many_files                            │   │
│  │ Sanitizes CSV / XLSX / XLS / DOCX / PPTX / PDF               │   │
│  │ Column-level precision for structured files                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Layer 1 — HTTP Proxy (port 47291)                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Intercepts all POST /v1/* requests                            │   │
│  │ Encrypts / masks request body before forwarding               │   │
│  │ Decrypts response tokens (reversible mode)                    │   │
│  │ Supports both JSON and SSE streaming responses                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                               │
                     encrypted / masked only
                               ▼
                       ┌───────────────┐
                       │  AI Provider  │
                       │     API       │
                       └───────────────┘
```

| Layer | Trigger | What it covers |
|:------|:--------|:---------------|
| 🅛 **L1: HTTP Proxy** | Every outbound API call | All message text sent to the model |
| 🅐 **L2: File Tool Hook** | `read`, `read_file`, `read_many_files` | CSV / XLSX / XLS / DOCX / PPTX / PDF |
| 🅟 **L3: Python Exec Hook** | `exec` / `process` (Python) | File reads inside Python scripts |
| 🅢 **L4: Shell Exec Hook** | `exec` / `process` (Shell/Node/R) | File reads inside shell commands |

---

## 🆕 What's New in v2.3.x

### v2.3.1 — Bug Fixes

- **Fixed: `proxy-process.js` ignored `mode` parameter** — `DATA_GUARD_MODE=reversible` had no effect because the env var was never passed to `ProxyServer`. Now correctly forwarded.
- **Fixed: regex overlap caused nested tokens** — ID card numbers (18 digits) were simultaneously matched by both `idCard` and `bankCard` patterns, producing malformed output like `<ENC>BANK_CARD_...3</ENC>33132547_2</ENC>`. Fixed with a priority-based greedy deduplication pass before replacement (`idCard` always wins over `bankCard`).
- **Fixed: SSE streaming responses not decrypted** — `_forwardWithDecryption` only handled `application/json`. OpenAI-style `text/event-stream` responses now have a dedicated SSE branch that decrypts each `data: {...}` chunk individually without buffering the stream.

### v2.3.0 — Reversible Encryption Mode

- **New: `ReversibleGuard`** (`reversible-guard.js`) — AES-256-GCM encryption engine. `preProcess` encrypts PII values into opaque tokens; `postProcess` decrypts them back. Keys are derived via `scrypt`. Token map is held in memory and cleared at session end.
- **New: `UnifiedEncryptionGuard`** (`src/core/UnifiedEncryptionGuard.js`) — single entry point for all four layers. `encryptInput()` handles all inbound data; `decryptOutput()` handles all outbound responses. Switching modes requires changing one config value.
- **New: `DATA_GUARD_MODE` environment variable** — set to `reversible` to enable encryption mode, `block` (default) for classic interception.
- **New: SSE streaming support** — reversible mode now correctly handles chunked `text/event-stream` responses from providers like OpenAI, decrypting tokens in each SSE event as it arrives.

---

## 🛡️ Supported Data Types

**30+ categories** of sensitive data are recognized and protected:

| Category | Example Input | Block Output | Reversible Output |
|:---------|:--------------|:-------------|:------------------|
| 📱 Phone number | `13812345678` | `138****5678` | `<ENC>PHONE_…</ENC>` |
| 🆔 Chinese ID | `110101199001011234` | `110***********1234` | `<ENC>ID_CARD_…</ENC>` |
| 💳 Bank card | `6222021234560123` | `6222**********0123` | `<ENC>BANK_CARD_…</ENC>` |
| 📧 Email | `zhangsan@example.com` | `z***g*@example.com` | `<ENC>EMAIL_…</ENC>` |
| 🛂 Passport | `E12345678` | `E********` | `<ENC>…</ENC>` |
| 🌐 IPv4 / IPv6 | `192.168.1.100` | `192.168.*.*` | `<ENC>IP_…</ENC>` |
| 🔐 API Key / Token | `sk-abc123…` | `sk-****` | `<ENC>API_KEY_…</ENC>` |
| 🧾 Tax / credit code | `91110108MA01ABC12G` | `91**************2G` | masked |
| 🧾 Invoice number | `FP1234567890` | `FP***********` | masked |
| 🔢 Order / transaction ID | `DD2023123456789` | `DD*************` | masked |
| 🏛️ Social security | `120110199001011234` | `**************5678` | masked |
| 👤 Name | `张明伟` | `用户_a3f2` | masked |
| 🏠 Address | `北京市朝阳区建国路88号` | `北京市朝阳区***` | masked |
| 💬 WeChat / QQ ID | `wx_abc123` | `wx_****` | masked |
| 🚗 Vehicle plate | `京A·12345` | `京A·***45` | masked |
| 💰 Amount | `¥352885.8` | `¥264664.35` | masked |
| ➕ **and more…** | | | |

### Column-level Precision (File Tool Hook)

When reading CSV or Excel files, Data Guard identifies sensitive columns by **header name** and applies the appropriate mask — not a blanket regex.

```
┌─────────────────────────────────────────────────────────────┐
│  Input (AI never sees this)                                  │
├─────────────────────────────────────────────────────────────┤
│  姓名,手机号,身份证号,银行卡号,邮箱                          │
│  张明伟,13812345678,110101199001011234,6222…0123,z@ex.com   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Output (what the AI receives)                               │
├─────────────────────────────────────────────────────────────┤
│  姓名,手机号,身份证号,银行卡号,邮箱                          │
│  用户_a3f2,138****5678,110***…1234,6222**…0123,z***@ex.com  │
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
openclaw plugins install data-guard-2.3.1.tgz

# 3. Restart the gateway
openclaw gateway restart

# 4. Verify
openclaw plugins list
# data-guard   loaded   2.3.1 ✅
```

---

## ⚙️ Configuration

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `port` | integer | `47291` | Port the local HTTP proxy listens on |
| `blockOnFailure` | boolean | `true` | Block request if desensitization fails |
| `fileGuard` | boolean | `true` | Enable Layer 2 file desensitization |
| `pythonGuard` | boolean | `true` | Enable Layer 3 Python exec hook |
| `shellGuard` | boolean | `true` | Enable Layer 4 Shell exec hook |
| `skipPrefix` | string | `[skip-guard]` | Prepend to bypass text desensitization |

### Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `DATA_GUARD_PORT` | `47291` | Proxy port (overrides plugin config) |
| `DATA_GUARD_MODE` | `block` | Protection mode: `block` or `reversible` |
| `DATA_GUARD_BLOCK_ON_FAILURE` | `true` | Fail-safe mode |
| `DATA_GUARD_ENCRYPTION_PASSWORD` | *(built-in)* | Master password for AES key derivation (reversible mode) |

### Enabling Reversible Mode

```json
// openclaw.json — plugins.entries.data-guard.config
{
  "port": 47291,
  "mode": "reversible",
  "blockOnFailure": false
}
```

Or via environment variable when starting the proxy manually:

```bash
DATA_GUARD_MODE=reversible openclaw gateway restart
```

---

## 🔐 Reversible Encryption — Technical Details

| Property | Value |
|:---------|:------|
| Algorithm | AES-256-GCM |
| Key derivation | `scrypt(password, salt, 32)` |
| IV | 16 random bytes per value |
| Auth tag | 16 bytes (GCM integrity check) |
| Token format | `<ENC>TYPE_timestamp_index</ENC>` |
| Token storage | In-memory `Map`, cleared on session end |
| Overlap resolution | Priority-based greedy dedup (`idCard > bankCard`) |
| Streaming support | SSE `text/event-stream` — per-chunk decryption |

**How to verify the LLM never sees raw data:** Run a mock upstream server on a local port, point the proxy at it via the base64-encoded URL route, and inspect the raw request body. You will see only `<ENC>…</ENC>` tokens — no original PII.

```bash
# Example: proxy route to mock server at :19999
MOCK_B64=$(node -e "console.log(Buffer.from('http://127.0.0.1:19999').toString('base64url'))")
curl -X POST "http://127.0.0.1:47291/proxy/${MOCK_B64}/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"手机号13812345678"}]}'

# Mock server receives:
# "content": "手机号<ENC>PHONE_1775833254949_1</ENC>"
```

---

## 🔄 Orphan Process Protection

The proxy runs as a **child process** of the gateway. Two mechanisms ensure it never becomes orphaned:

| Mechanism | Side | Description |
|:----------|:-----|:------------|
| ❤️ **Heartbeat** | Proxy | Every 5s checks parent via `process.kill(ppid, 0)`. Shuts down if parent is gone. |
| 🧹 **PID Cleanup** | Plugin | On every `start()`, kills stale process by PID file before spawning new one. |
| 🔍 **Port Cleanup** | Plugin | Falls back to `lsof -ti :PORT` if PID file is stale or missing. |

---

## ⏭️ Skipping Desensitization

To send a message **without** text desensitization (Layer 1), prefix it with `[skip-guard]` (configurable):

```
[skip-guard] This message goes through without masking.
```

> ⚠️ Layer 2–4 file and exec desensitization are **unaffected** by this prefix.

---

## 🏗️ Project Structure

```
data-guard/
│
├── index.js                          # Plugin entry — wires all four layers together
├── reversible-guard.js               # AES-256-GCM reversible encryption engine
├── openclaw.plugin.json              # Plugin manifest
├── package.json
│
└── src/
    ├── core/
    │   ├── desensitize.js            # Desensitization engine (30+ rules, zero deps)
    │   └── UnifiedEncryptionGuard.js # Unified encrypt/decrypt entry for all layers
    │
    ├── input/
    │   └── FileReader.js             # Reads file → parses → desensitizes → temp file
    │
    ├── output/
    │   └── TempFileManager.js        # Temp file lifecycle management
    │
    ├── migrate/
    │   └── cleanLegacy.js            # Removes old hook/proxy artifacts on install
    │
    ├── proxy/
    │   ├── ProxyServer.js            # HTTP reverse proxy (block + reversible + SSE)
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
        ├── tool/
        │   ├── FileDesensitizePlugin.js
        │   └── formats/
        │       ├── FileFormat.js      # Abstract format + registry
        │       ├── CsvFormat.js
        │       ├── XlsxFormat.js
        │       ├── XlsFormat.js
        │       ├── DocxFormat.js      # DOCX / DOTX (ZIP + XML, zero deps)
        │       ├── PptxFormat.js      # PPTX / POTX (ZIP + XML, zero deps)
        │       ├── PdfFormat.js       # PDF (content stream extraction, zero deps)
        │       └── index.js
        │
        └── exec/
            ├── PythonExecPlugin.js    # Python exec hook (Layer 3)
            ├── ShellExecPlugin.js     # Shell / Node / R exec hook (Layer 4)
            └── execUtils.js           # Shared exec utilities
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

### Using UnifiedEncryptionGuard directly

```js
import { UnifiedEncryptionGuard } from 'data-guard/core/UnifiedEncryptionGuard'

const guard = new UnifiedEncryptionGuard({
  mode: 'reversible',
  encryptionPassword: 'my-secret',
  enabledTypes: ['email', 'phone', 'idCard'],
})

const { data } = guard.encryptInput('联系我：13812345678', { source: 'custom' })
// data → "联系我：<ENC>PHONE_…</ENC>"

const { data: restored } = guard.decryptOutput(data, { source: 'custom' })
// restored → "联系我：13812345678"
```

---

## 🔧 Troubleshooting

**Port 47291 already in use**
```bash
# Automatic cleanup is built-in since v2.0.6 — this should not happen
lsof -i :47291
kill <PID>
openclaw gateway restart
```

**Reversible mode not activating**
```bash
# Check that DATA_GUARD_MODE is set and the proxy was restarted after the change
tail -f ~/.openclaw/data-guard/proxy.log
# Should show: [INFO] Data Guard proxy started … (mode=reversible)
```

**Tokens appearing in final response (not decrypted)**
```bash
# This means the proxy restarted between encrypt and decrypt, clearing the token map.
# Tokens from a previous proxy session cannot be decrypted. Restart the conversation.
```

**Plugin not loading**
```bash
openclaw plugins list
openclaw plugins uninstall data-guard --force
openclaw plugins install data-guard-2.3.1.tgz
openclaw gateway restart
```

**Check proxy logs**
```bash
tail -f ~/.openclaw/data-guard/proxy.log
```

---

## 📋 Changelog

### v2.3.1
- Fix: `proxy-process.js` was not forwarding `DATA_GUARD_MODE` to `ProxyServer`
- Fix: regex overlap between `idCard` and `bankCard` caused nested/malformed tokens
- Fix: SSE `text/event-stream` responses were not decrypted in reversible mode

### v2.3.0
- New: Reversible Encryption Mode (AES-256-GCM)
- New: `ReversibleGuard` — per-value encryption with in-memory token map
- New: `UnifiedEncryptionGuard` — single entry point for all four layers
- New: `DATA_GUARD_MODE` environment variable

### v2.2.x
- New: Python exec hook (Layer 3)
- New: Shell / Node / R exec hook (Layer 4)
- New: `cleanLegacy` migration utility

### v2.1.0
- New: DOCX, PPTX, PDF format support
- New: `lsof`-based port cleanup fallback

### v2.0.6
- Initial stable release
- HTTP proxy layer + file tool hook
- CSV / XLSX / XLS column-level desensitization

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first to discuss significant changes.

---

## 👥 Authors

| | |
|:--|:--|
| **Alan Song** | Lead Developer |
| **Roxy Li** | Contributor |
| **keyuzhang838-dotcom** | Hook Plugins Module |
| **Ayang77777** | Contributor |

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
  <img src="https://img.shields.io/badge/AES--256--GCM-Reversible_Encryption-red?style=for-the-badge&logo=lock" />
</p>

<p align="center">
  <sub>Built for privacy · Designed for security</sub>
</p>
