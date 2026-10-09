// 发布到 GitHub Pages：创建仓库 → 上传 dist 全部文件（glossary 用裁剪版）→ 开启 Pages
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const DIST = join(ROOT, 'app', 'dist')
const REPO = 'kaoyan-english'
const OWNER = 'AFOGSHEEP'

const TOKEN = process.env.GH_TOKEN
if (!TOKEN) throw new Error('缺少 GH_TOKEN 环境变量')
const H = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
const api = (p, init) => fetch(`https://api.github.com${p}`, { headers: H, ...init }).then(async r => {
  if (!r.ok) throw new Error(`HTTP ${r.status} ${p}: ${(await r.text()).slice(0, 200)}`)
  return r.status === 204 ? null : r.json()
})

// 1. 创建仓库（幂等）
try {
  await api('/user/repos', { method: 'POST', body: JSON.stringify({ name: REPO, description: '考研英语（一/二）真题题库 · PWA', homepage: `https://${OWNER}.github.io/${REPO}/`, private: false, has_issues: false }) })
  console.log('仓库已创建')
} catch (e) { console.log('仓库已存在或：', e.message.slice(0, 80)) }

// 2. 收集文件（glossary 替换为裁剪版）
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const fp = join(dir, name)
    if (statSync(fp).isDirectory()) walk(fp)
    else files.push(fp)
  }
}
walk(DIST)
// 发布目录策略：全量 glossary 替换为裁剪版（<1MB 限制）
const glossaryTrimmed = readFileSync(join(ROOT, 'app', 'public', 'content', 'vocab', 'glossary-trimmed.json'))
const uploadList = files.map(fp => {
  let data = readFileSync(fp)
  if (fp.endsWith('glossary.json')) data = glossaryTrimmed
  return { path: relative(DIST, fp).replace(/\\/g, '/'), data, size: data.length }
})
console.log(`待上传 ${uploadList.length} 个文件，总 ${Math.round(uploadList.reduce((s, f) => s + f.size, 0) / 1024 / 1024)}MB`)

// 3. 逐文件 PUT（已存在的先拿 sha 覆盖；4 并发）
let ok = 0, skip = 0, fail = 0
const existing = new Map()
try {
  let page = 1
  while (true) {
    const list = await api(`/repos/${OWNER}/${REPO}/contents?page=${page}&per_page=100`)
    for (const f of list) existing.set(f.path, f.sha)
    if (list.length < 100) break
    page++
  }
} catch {}
console.log(`仓库已有 ${existing.size} 个文件`)

const queue = [...uploadList]
const putFile = async (f) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      let sha
      try { sha = (await api(`/repos/${OWNER}/${REPO}/contents/${f.path}`)).sha } catch { /* 不存在 */ }
      await api(`/repos/${OWNER}/${REPO}/contents/${f.path}`, {
        method: 'PUT',
        body: JSON.stringify({ message: `deploy: ${f.path}`, content: f.data.toString('base64'), ...(sha ? { sha } : {}) })
      })
      return true
    } catch (e) {
      if (String(e.message).includes('HTTP 409') || String(e.message).includes('HTTP 403')) {
        await new Promise(s => setTimeout(s, 800 * (attempt + 1)))
        continue
      }
      throw e
    }
  }
  return false
}
// 串行上传（contents API 并发提交会 409 分支竞争）
for (const f of queue) {
  try {
    const r = await putFile(f)
    if (r) ok++
    else { fail++; console.log('RETRY-EXHAUSTED', f.path) }
  } catch (e) { fail++; console.log('FAIL', f.path, e.message.slice(0, 100)) }
  if ((ok + fail) % 10 === 0) console.log(`  进度 ${ok + fail}/${uploadList.length}`)
}
console.log(`上传完成 ok=${ok} fail=${fail}`)

// 4. 确保 main 分支 + 开 Pages
try {
  await api(`/repos/${OWNER}/${REPO}/pages`, { method: 'POST', body: JSON.stringify({ source: { branch: 'main', path: '/' } }) })
  console.log('Pages 已开启')
} catch (e) { console.log('Pages：', e.message.slice(0, 80)) }

const info = await api(`/repos/${OWNER}/${REPO}/pages`)
console.log('URL:', info.html_url, '| status:', info.status)
