/**
 * index.js — Data Guard Unified OpenClaw Plugin 运行时入口
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                     架构分层（由外到内）                              │
 * │                                                                     │
 * │  ┌──────────────────────────────────────────────────────────────┐  │
 * │  │  输入层 (src/input/)                                          │  │
 * │  │  FileReader — 读取文件、解析格式、执行脱敏、写临时文件          │  │
 * │  └──────────────────────────────────────────────────────────────┘  │
 * │                                                                     │
 * │  ┌──────────────────────────────────────────────────────────────┐  │
 * │  │  输出层 (src/output/)                                         │  │
 * │  │  TempFileManager — 临时文件生命周期管理                        │  │
 * │  └──────────────────────────────────────────────────────────────┘  │
 * │                                                                     │
 * │  ┌──────────────────────────────────────────────────────────────┐  │
 * │  │  代理层 (src/proxy/)                                          │  │
 * │  │  ProxyServer   — HTTP 反向代理，对 messages 文本兜底脱敏       │  │
 * │  │  UrlRewriter   — 改写 openclaw.json 中的 provider baseUrl     │  │
 * │  └──────────────────────────────────────────────────────────────┘  │
 * │                                                                     │
 * │  ┌──────────────────────────────────────────────────────────────┐  │
 * │  │  插件层 (src/plugins/)                                        │  │
 * │  │  Plugin              — 所有插件的抽象基类                      │  │
 * │  │  ToolPlugin          — 工具调用插件基类                        │  │
 * │  │  ProxyPlugin         — HTTP 代理插件（注册 registerService）   │  │
 * │  │  FileDesensitizePlugin — 文件脱敏插件（拦截 before_tool_call） │  │
 * │  │                                                               │  │
 * │  │  文件格式插件 (src/plugins/tool/formats/)                     │  │
 * │  │  FileFormat    — 格式处理器抽象基类 + 注册表                   │  │
 * │  │  CsvFormat     — CSV 格式处理器                               │  │
 * │  │  XlsxFormat    — XLSX 格式处理器                              │  │
 * │  │  XlsFormat     — XLS 格式处理器                               │  │
 * │  └──────────────────────────────────────────────────────────────┘  │
 * │                                                                     │
 * │  ┌──────────────────────────────────────────────────────────────┐  │
 * │  │  核心层 (src/core/)                                           │  │
 * │  │  desensitize — 脱敏引擎（30+ 类规则，零外部依赖）              │  │
 * │  └──────────────────────────────────────────────────────────────┘  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * 两层互补，无冲突：
 *   - FileDesensitizePlugin 在工具层先脱敏文件内容，AI 拿到的就是脱敏后的 CSV
 *   - ProxyPlugin 在 HTTP 层对 messages 文本兜底，防止其他途径泄露
 *   - 共享同一份 desensitize 引擎，逻辑完全一致
 */

import { join, dirname }    from 'path'
import { fileURLToPath }    from 'url'
import { homedir }          from 'os'
import { ProxyPlugin }      from './src/plugins/ProxyPlugin.js'
import { FileDesensitizePlugin } from './src/plugins/tool/FileDesensitizePlugin.js'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const PLUGIN_DIR = __dirname

// ── 跨平台路径解析 ────────────────────────────────────────────────────────────

function getOpenClawDir() {
  const home = homedir()
  if (process.env.OPENCLAW_DIR) return process.env.OPENCLAW_DIR
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || home, '.openclaw')
  }
  return join(home, '.openclaw')
}

// ── Plugin 注册入口 ───────────────────────────────────────────────────────────

export function register(api) {
  // ── 读取配置 ──────────────────────────────────────────────────────────────
  const pluginConfig = api.config?.plugins?.entries?.['data-guard']?.config ?? {}

  const port           = pluginConfig.port           ?? 47291
  const blockOnFailure = pluginConfig.blockOnFailure ?? true
  const fileGuardEnabled = pluginConfig.fileGuard    ?? true

  const openclawDir     = getOpenClawDir()
  const openclawJson    = join(openclawDir, 'openclaw.json')
  const tempDir         = join(openclawDir, 'data-guard', 'tmp')
  const proxyScript     = join(PLUGIN_DIR, 'src', 'proxy', 'proxy-process.js')

  const logger = api.logger

  // ── 层 1：注册 HTTP 代理插件 ──────────────────────────────────────────────
  const proxyPlugin = new ProxyPlugin({
    proxyScriptPath:  proxyScript,
    openclawJsonPath: openclawJson,
  })
  proxyPlugin.register(api, { port, blockOnFailure }, logger)

  // ── 层 2：注册文件脱敏插件（工具调用层）──────────────────────────────────
  if (!fileGuardEnabled) {
    logger?.info('[data-guard] 文件脱敏层已禁用（fileGuard=false）')
  } else {
    const filePlugin = new FileDesensitizePlugin(tempDir)
    filePlugin.register(api, pluginConfig, logger)
  }

  logger?.info('[data-guard] registered (HTTP proxy layer + tool call layer)')
}
