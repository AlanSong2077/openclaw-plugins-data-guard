/**
 * src/proxy/ProxyServer.js — 代理层：HTTP 反向代理服务器
 *
 * 职责：
 *   1. 监听本地端口，拦截所有发往 AI 的 HTTP 请求
 *   2. 对 POST JSON 请求体执行递归脱敏（兜底层）
 *   3. 将脱敏后的请求转发到真实上游
 *
 * 路由方案：
 *   index.js 把每个 provider 的 baseUrl 改写为：
 *     http://127.0.0.1:<port>/proxy/<base64url(原始URL)>
 *   ProxyServer 从路径中解码出真实上游 URL 并转发。
 *
 * 与 ToolPlugin 的关系：
 *   - ToolPlugin 在工具调用层精准脱敏文件内容（前置）
 *   - ProxyServer 在 HTTP 层对 messages 文本兜底脱敏（后置）
 *   - 两层互补，共享同一份 desensitize 引擎
 */

import http  from 'http'
import https from 'https'
import { existsSync, readFileSync, writeFileSync, unlinkSync, appendFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join }    from 'path'
import { UnifiedEncryptionGuard } from '../core/UnifiedEncryptionGuard.js'

// ── 配置 ──────────────────────────────────────────────────────────────────────

const DEFAULT_PORT           = 47291
const DEFAULT_MODE           = process.env.DATA_GUARD_MODE || 'block'  // 'block' | 'reversible'
const DEFAULT_BLOCK_ON_FAIL  = true

// ── 日志工厂 ──────────────────────────────────────────────────────────────────

/**
 * 创建一个简单的文件+stdout 日志器
 * @param {string} logFile
 * @returns {{ info, warn, error }}
 */
function createLogger(logFile) {
  const write = (level, msg) => {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`
    process.stdout.write(line)
    try { appendFileSync(logFile, line) } catch {}
  }
  return {
    info:  msg => write('INFO',  msg),
    warn:  msg => write('WARN',  msg),
    error: msg => write('ERROR', msg),
  }
}

// ── 路由解析 ──────────────────────────────────────────────────────────────────

/**
 * 从请求路径解码真实上游 URL
 *
 * 路径格式：/proxy/<base64url(originalUrl)>[/extra/path]
 *
 * 例：
 *   请求路径: /proxy/aHR0cHM6Ly9hcGkubWluaW1heC5jaGF0L3Yx/chat/completions
 *   解码得:   https://api.minimax.chat/v1
 *   转发到:   https://api.minimax.chat/v1/chat/completions
 *
 * @param {string} reqUrl
 * @returns {{ protocol, hostname, port, path } | null}
 */
function resolveTarget(reqUrl) {
  const proxyMatch = reqUrl.match(/^\/proxy\/([A-Za-z0-9_\-=]+)(\/.*)?$/)
  if (proxyMatch) {
    try {
      const decoded  = Buffer.from(proxyMatch[1], 'base64url').toString('utf8')
      const base     = new URL(decoded)
      const suffix   = proxyMatch[2] ?? ''
      const fullPath = base.pathname.replace(/\/$/, '') + suffix + (base.search ?? '')
      return {
        protocol: base.protocol,
        hostname: base.hostname,
        port:     base.port || (base.protocol === 'https:' ? '443' : '80'),
        path:     fullPath,
      }
    } catch { return null }
  }
  return null
}

// ── 脱敏核心 ──────────────────────────────────────────────────────────────────

/**
 * 创建统一加密守卫实例
 * 优先使用构造参数，其次读环境变量
 */
function createGuard(logger, options = {}) {
  const mode     = options.mode     || process.env.DATA_GUARD_MODE     || DEFAULT_MODE;
  const password = options.password || process.env.DATA_GUARD_ENCRYPTION_PASSWORD || 'openclaw-data-guard-key';
  const blockOnFailure = options.blockOnFailure ?? (process.env.DATA_GUARD_BLOCK_ON_FAILURE !== 'false');

  return new UnifiedEncryptionGuard({
    mode,
    encryptionPassword: password,
    blockOnFailure,
    enabledTypes: ['email', 'phone', 'idCard', 'bankCard', 'ipAddress', 'apiKey'],
    logger
  });
}

// ── HTTP 转发 ─────────────────────────────────────────────────────────────────

function forwardRequest(target, reqMethod, reqHeaders, body, res) {
  const isHttps   = target.protocol === 'https:'
  const transport = isHttps ? https : http
  const port      = parseInt(target.port) || (isHttps ? 443 : 80)

  const fwdHeaders = { ...reqHeaders }
  delete fwdHeaders['x-upstream-host']
  delete fwdHeaders['x-upstream-protocol']
  fwdHeaders['host'] = target.hostname

  const upstreamReq = transport.request(
    { hostname: target.hostname, port, path: target.path, method: reqMethod, headers: fwdHeaders },
    upstreamRes => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers)
      upstreamRes.pipe(res)
    }
  )

  upstreamReq.on('error', err => {
    if (!res.headersSent) {
      res.writeHead(502)
      res.end(JSON.stringify({ error: { message: `Data Guard Proxy: upstream error: ${err.message}` } }))
    }
  })

  upstreamReq.write(body)
  upstreamReq.end()
}

// ── ProxyServer 类 ────────────────────────────────────────────────────────────

export class ProxyServer {
  /**
   * @param {object} options
   * @param {number}  [options.port=47291]           - 监听端口
   * @param {boolean} [options.blockOnFailure=true]  - 脱敏失败时是否阻断请求
   * @param {string}  [options.logFile]              - 日志文件路径
   * @param {string}  [options.mode='block']         - 工作模式: 'block' | 'reversible'
   */
  constructor(options = {}) {
    this.port           = options.port           ?? DEFAULT_PORT
    this.blockOnFailure = options.blockOnFailure ?? DEFAULT_BLOCK_ON_FAIL
    this.logFile        = options.logFile        ?? null
    this.mode           = options.mode           ?? DEFAULT_MODE
    this._server        = null
    this._logger        = options.logFile ? createLogger(options.logFile) : null
    this._guard         = createGuard(this._logger, {
      mode:            this.mode,
      blockOnFailure:  this.blockOnFailure,
      password:        options.encryptionPassword,
    })
  }

  /**
   * 启动代理服务器
   * @returns {Promise<void>}
   */
  start() {
    return new Promise((resolve, reject) => {
      this._server = http.createServer((req, res) => this._handleRequest(req, res))

      this._server.on('error', err => {
        if (err.code === 'EADDRINUSE') {
          this._log('error', `端口 ${this.port} 已被占用`)
        } else {
          this._log('error', `服务器错误: ${err.message}`)
        }
        reject(err)
      })

      this._server.listen(this.port, '127.0.0.1', () => {
        this._log('info', `Data Guard proxy started, listening on http://127.0.0.1:${this.port}`)
        resolve()
      })
    })
  }

  /**
   * 停止代理服务器
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      if (!this._server) { resolve(); return }
      this._server.close(() => {
        this._log('info', '代理已停止')
        this._server = null
        resolve()
      })
    })
  }

  /**
   * 处理单个 HTTP 请求
   * @private
   */
  _handleRequest(req, res) {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks)

      // 解析目标上游
      const target = resolveTarget(req.url)
      if (!target) {
        res.writeHead(404)
        res.end(JSON.stringify({ error: { message: 'Data Guard Proxy: no upstream route' } }))
        return
      }

      // 只对 POST + JSON 请求执行脱敏
      const contentType = req.headers['content-type'] ?? ''
      const isJsonPost  = req.method === 'POST' && contentType.includes('application/json')

      if (!isJsonPost) {
        forwardRequest(target, req.method, req.headers, rawBody, res)
        return
      }

      // 解析请求体
      let parsed
      try {
        parsed = JSON.parse(rawBody.toString('utf8'))
      } catch {
        this._log('warn', '请求体解析失败，直接透传')
        forwardRequest(target, req.method, req.headers, rawBody, res)
        return
      }

      // 使用统一加密入口处理请求体
      let encryptResult
      try {
        encryptResult = this._guard.encryptInput(parsed, { source: 'http' })
      } catch (err) {
        this._log('error', `加密处理失败: ${err.message}`)
        if (this.blockOnFailure) {
          res.writeHead(500)
          res.end(JSON.stringify({ error: { message: 'Data Guard Proxy: encryption failed, request blocked' } }))
          return
        } else {
          this._log('warn', `加密失败，透传原文（blockOnFailure=false）`)
          forwardRequest(target, req.method, req.headers, rawBody, res)
          return
        }
      }

      // 阻断模式：如果检测到敏感数据且不允许通过
      if (!encryptResult.allowed) {
        this._log('error', `请求被阻断: ${encryptResult.reason}`)
        res.writeHead(403)
        res.end(JSON.stringify({ error: { message: `Data Guard Proxy: ${encryptResult.reason}` } }))
        return
      }

      // 转发请求（使用加密后的数据）
      const newBody = Buffer.from(JSON.stringify(encryptResult.data), 'utf8')
      const newHeaders = { ...req.headers, 'content-length': String(newBody.length) }
      
      // 如果是可逆加密模式，需要拦截响应并解密
      if (this.mode === 'reversible' || process.env.DATA_GUARD_MODE === 'reversible') {
        this._forwardWithDecryption(target, req.method, newHeaders, newBody, res)
      } else {
        forwardRequest(target, req.method, newHeaders, newBody, res)
      }
    })

    req.on('error', err => {
      this._log('error', `请求读取失败: ${err.message}`)
      if (!res.headersSent) { res.writeHead(500); res.end() }
    })
  }

  /**
   * 转发请求并解密响应（可逆加密模式）
   * 支持两种响应格式：
   *   1. application/json  — 缓冲全部响应后解密
   *   2. text/event-stream — SSE 流式响应，逐行解密每个 data: {...} chunk
   * @private
   */
  _forwardWithDecryption(target, reqMethod, reqHeaders, body, res) {
    const isHttps   = target.protocol === 'https:'
    const transport = isHttps ? https : http
    const port      = parseInt(target.port) || (isHttps ? 443 : 80)

    const fwdHeaders = { ...reqHeaders }
    delete fwdHeaders['x-upstream-host']
    delete fwdHeaders['x-upstream-protocol']
    fwdHeaders['host'] = target.hostname

    const upstreamReq = transport.request(
      { hostname: target.hostname, port, path: target.path, method: reqMethod, headers: fwdHeaders },
      upstreamRes => {
        const contentType = upstreamRes.headers['content-type'] || ''
        const isSSE       = contentType.includes('text/event-stream')

        // ── SSE 流式响应：逐行解密 ──────────────────────────────────────────
        if (isSSE) {
          // 透传 SSE 响应头（保留 transfer-encoding: chunked）
          const sseHeaders = { ...upstreamRes.headers }
          delete sseHeaders['content-length']  // SSE 不能有 content-length
          res.writeHead(upstreamRes.statusCode, sseHeaders)

          let buffer = ''
          let totalDecrypted = 0

          upstreamRes.on('data', chunk => {
            buffer += chunk.toString('utf8')
            // SSE 以 \n\n 分隔事件，逐事件处理
            const parts = buffer.split('\n\n')
            buffer = parts.pop() ?? ''  // 最后一段可能不完整，留到下次

            for (const event of parts) {
              const lines = event.split('\n')
              const outLines = []

              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const jsonStr = line.slice(6)
                    const parsed  = JSON.parse(jsonStr)
                    const decryptResult = this._guard.decryptOutput(parsed, { source: 'sse-chunk' })
                    totalDecrypted += decryptResult.decryptedCount || 0
                    outLines.push('data: ' + JSON.stringify(decryptResult.data))
                  } catch {
                    outLines.push(line)  // 解析失败原样透传
                  }
                } else {
                  outLines.push(line)
                }
              }

              res.write(outLines.join('\n') + '\n\n')
            }
          })

          upstreamRes.on('end', () => {
            // 处理缓冲区中剩余的不完整事件
            if (buffer.trim()) {
              res.write(buffer)
            }
            if (totalDecrypted > 0) {
              this._log('info', `SSE 流式响应解密完成: ${totalDecrypted} 个 token`)
            }
            res.end()
          })

          upstreamRes.on('error', err => {
            this._log('warn', `SSE 上游响应错误: ${err.message}`)
            res.end()
          })

          return
        }

        // ── 普通 JSON 响应：缓冲后解密 ─────────────────────────────────────
        const chunks = []
        upstreamRes.on('data', chunk => chunks.push(chunk))
        upstreamRes.on('end', () => {
          const rawResponse = Buffer.concat(chunks)

          let responseData = rawResponse

          if (contentType.includes('application/json')) {
            try {
              const parsed = JSON.parse(rawResponse.toString('utf8'))
              const decryptResult = this._guard.decryptOutput(parsed, { source: 'http-response' })
              responseData = Buffer.from(JSON.stringify(decryptResult.data), 'utf8')

              if (decryptResult.decryptedCount > 0) {
                this._log('info', `响应解密完成: ${decryptResult.decryptedCount} 个 token`)
              }
            } catch (err) {
              this._log('warn', `响应解密失败: ${err.message}`)
            }
          }

          // 更新 content-length，同时删除 transfer-encoding（两者不能共存）
          const newHeaders = { ...upstreamRes.headers }
          newHeaders['content-length'] = String(responseData.length)
          delete newHeaders['transfer-encoding']

          res.writeHead(upstreamRes.statusCode, newHeaders)
          res.end(responseData)
        })
      }
    )

    upstreamReq.on('error', err => {
      if (!res.headersSent) {
        res.writeHead(502)
        res.end(JSON.stringify({ error: { message: `Data Guard Proxy: upstream error: ${err.message}` } }))
      }
    })

    upstreamReq.write(body)
    upstreamReq.end()
  }

  /**
   * 内部日志（转发到外部 logger 或 stdout）
   * @private
   */
  _log(level, msg) {
    if (this._logger) {
      this._logger[level]?.(msg)
    } else {
      const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] [proxy] ${msg}\n`
      process.stdout.write(line)
    }
  }
}
