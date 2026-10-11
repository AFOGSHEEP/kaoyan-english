const { app, BrowserWindow, Menu, shell } = require('electron')
const http = require('node:http')
const path = require('node:path')
const crypto = require('node:crypto')
const fs = require('node:fs')

// ---------- AI 本机 HTTP API ----------
// 监听 127.0.0.1，鉴权 token 写入用户数据目录 kaoyan-api.json（含端口），
// 本机 AI 助手读取该文件后即可用 curl 操作应用数据（见 CLAUDE.md「AI 操作接口」）。
const API_TOKEN = crypto.randomBytes(16).toString('hex')

function startApiServer(getWin) {
  const routes = [
    ['GET', /^\/api\/ping$/, () => Promise.resolve({ ok: true, app: 'kaoyan-english', version: '1.0', ts: Date.now() })],
    ['GET', /^\/api\/stats$/, (m, q) => callRenderer(getWin, `kaoyanAPI.stats()`)],
    ['GET', /^\/api\/papers$/, () => callRenderer(getWin, `kaoyanAPI.papers()`)],
    ['GET', /^\/api\/paper\/([\w-]+)$/, (m) => callRenderer(getWin, `kaoyanAPI.paper(${JSON.stringify(m[1])})`)],
    ['GET', /^\/api\/answers(?:\/([\w-]+))?$/, (m) => callRenderer(getWin, `kaoyanAPI.answers(${m[1] ? JSON.stringify(m[1]) : ''})`)],
    ['GET', /^\/api\/mistakes$/, () => callRenderer(getWin, `kaoyanAPI.mistakes()`)],
    ['GET', /^\/api\/words$/, () => callRenderer(getWin, `kaoyanAPI.words()`)],
    ['POST', /^\/api\/words$/, (m, q, body) => callRenderer(getWin, `kaoyanAPI.addWords(${safeJson(body)})`)],
    ['PATCH', /^\/api\/words\/(\d+)$/, (m, q, body) => callRenderer(getWin, `kaoyanAPI.updateWord(${m[1]}, ${safeJson(body)})`)],
    ['DELETE', /^\/api\/words\/(\d+)$/, (m) => callRenderer(getWin, `kaoyanAPI.deleteWord(${m[1]})`)],
    ['GET', /^\/api\/annotations$/, () => callRenderer(getWin, `kaoyanAPI.annotations()`)],
    ['GET', /^\/api\/logs(?:\?limit=(\d+))?$/, (m) => callRenderer(getWin, `kaoyanAPI.logs(${m[1] || 200})`)],
    ['GET', /^\/api\/plan$/, () => callRenderer(getWin, `kaoyanAPI.getPlan()`)],
    ['POST', /^\/api\/plan$/, (m, q, body) => {
      const b = parseBodyJson(body)
      return callRenderer(getWin, `kaoyanAPI.setPlan(${JSON.stringify(b.items || b)}, ${JSON.stringify(b.by || 'AI')})`)
    }],
    ['DELETE', /^\/api\/plan$/, () => callRenderer(getWin, `kaoyanAPI.clearPlan()`)],
    ['GET', /^\/api\/export$/, () => callRenderer(getWin, `kaoyanAPI.exportAll()`)],
    ['POST', /^\/api\/import$/, (m, q, body) => callRenderer(getWin, `kaoyanAPI.importAll(${safeJson(body)})`)]
  ]

  const parseBodyJson = (s) => { try { return JSON.parse(s || '{}') } catch { return {} } }
  const safeJson = (s) => JSON.stringify(parseBodyJson(s)) // 重新序列化，防止代码注入

  function callRenderer(getWin, expr) {
    const win = getWin()
    if (!win || win.isDestroyed()) return Promise.reject(new Error('window not ready'))
    return win.webContents.executeJavaScript(`Promise.resolve(${expr}).then(r => JSON.stringify(r ?? null))`)
      .then(s => JSON.parse(s))
  }

  const server = http.createServer((req, res) => {
    const send = (code, data) => {
      const buf = Buffer.from(JSON.stringify(data))
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
      res.end(buf)
    }
    // 鉴权：X-Kaoyan-Token 头（网页无法跨域携带自定义头，天然防 CSRF；本机工具直接带）
    if (req.headers['x-kaoyan-token'] !== API_TOKEN) return send(401, { error: 'unauthorized', hint: 'token 在用户数据目录 kaoyan-api.json' })
    let body = ''
    req.on('data', c => { body += c; if (body.length > 20e6) req.destroy() })
    req.on('end', () => {
      const route = routes.find(([method, re]) => method === req.method && re.test(req.url))
      if (!route) return send(404, { error: 'not found', endpoints: routes.map(r => r[0] + ' ' + String(r[1])) })
      route[2](req.url.match(route[1]), req.url, body)
        .then(data => send(200, data))
        .catch(e => send(500, { error: String(e.message || e) }))
    })
  })

  return new Promise((resolve) => {
    let port = 3742
    server.on('error', () => { // 端口占用则递增重试
      port += 1
      if (port > 3752) { resolve(null); return }
      server.listen(port, '127.0.0.1')
    })
    server.listen(port, '127.0.0.1', () => resolve(port))
  })
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 620,
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  Menu.setApplicationMenu(null)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.loadFile(path.join(__dirname, '../dist/index.html'))
  return win
}

app.whenReady().then(async () => {
  const win = createWindow()
  const port = await startApiServer(() => win)
  const apiInfo = { app: 'kaoyan-english', port, token: API_TOKEN, base: `http://127.0.0.1:${port}/api`, note: 'AI 助手请携带 X-Kaoyan-Token 头调用，接口文档见项目 CLAUDE.md' }
  try { fs.writeFileSync(path.join(app.getPath('userData'), 'kaoyan-api.json'), JSON.stringify(apiInfo, null, 2)) } catch {}
  if (port) console.log(`[kaoyan-api] http://127.0.0.1:${port}/api (token in userData/kaoyan-api.json)`)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
