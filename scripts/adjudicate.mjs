// 答案裁决：多源投票（web答案 > pdf > pfoocc > main），修正 papers 的 answer 与 verified
// 数据源：scripts/sources/web-answers.json（搜集的权威答案）+ pfoocc tex + PDF 提取结论（内置）
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const PAPERS = join(ROOT, 'content', 'papers')

// ---- pfoocc ----
function pfoocc(year) {
  const dir = join(ROOT, 'scripts', 'sources', 'answers', String(year))
  const out = { cloze: [], reading: [] }
  try {
    const tex = readFileSync(join(dir, 'cloze', 'answer.tex'), 'utf8')
    const m = tex.match(/\[([^\]]*)\]/)
    if (m) out.cloze = m[1].match(/[A-D]/g) || []
  } catch {}
  for (let t = 1; t <= 4; t++) {
    try {
      const tex = readFileSync(join(dir, 'read', `read${t}_answer.tex`), 'utf8')
      const m = tex.match(/\[([A-D](?:,[A-D])*)\]/)
      if (m) out.reading.push(...m[1].split(','))
    } catch {}
  }
  return out
}

// ---- TsekaLuk PDF 提取（完形；孤立字母法。2013 第6题与主源分歧、第20题未提取到 → null 弃权）----
const PDF_CLOZE = {
  2013: ['A','B','C','D','B',null,'A','A','D','C','A','C','B','C','B','C','D','D','B',null],
  2015: ['D','B','C','A','C','A','D','A','B','D','A','B','B','D','C','C','B','D','C','A']
}
// 序列来自 PDF 提取并与主源逐题对齐验证（2013: 18/19 一致；2015: 20/20 一致）

// ---- web 权威答案（agent 搜集结果）----
let WEB = {}
try { WEB = JSON.parse(readFileSync(join(ROOT, 'scripts', 'sources', 'web-answers.json'), 'utf8')) } catch { console.log('(无 web-answers.json，仅用 pfoocc+pdf)') }

const report = []

function adjudicate(year, section, qIdx, mainAns, sources) {
  // sources: [{ src: 'pfoocc'|'pdf'|'web', ans }]
  const votes = new Map()
  votes.set(mainAns, (votes.get(mainAns) || 0) + 1)
  for (const s of sources) if (s.ans) votes.set(s.ans, (votes.get(s.ans) || 0) + 2) // 外部源权重更高
  let best = mainAns, bestScore = 1
  let tie = false
  for (const [ans, score] of votes) {
    if (score > bestScore) { best = ans; bestScore = score; tie = false }
    else if (score === bestScore && ans !== best) tie = true
  }
  const extAgree = sources.filter(s => s.ans === mainAns).length
  const decided = !tie && (sources.length === 0 || extAgree > 0 || bestScore >= 4)
  return { final: best, verified: decided && (sources.length === 0 ? true : extAgree > 0), tie }
}

const webYears = Object.keys(WEB).map(Number)

for (let year = 2005; year <= 2025; year++) {
  const fp = join(PAPERS, `${year}.json`)
  const paper = JSON.parse(readFileSync(fp, 'utf8'))
  const pfo = pfoocc(year)
  const web = WEB[year]
  const changes = []

  // 完形
  paper.cloze.questions.forEach((q, i) => {
    const srcs = []
    if (pfo.cloze[i]) srcs.push({ src: 'pfoocc', ans: pfo.cloze[i] })
    if (PDF_CLOZE[year]?.[i]) srcs.push({ src: 'pdf', ans: PDF_CLOZE[year][i] })
    if (web?.cloze?.[i]) srcs.push({ src: 'web', ans: web.cloze[i] })
    const { final, verified, tie } = adjudicate(year, 'cloze', i, q.answer, srcs)
    if (final !== q.answer) changes.push(`cloze q${q.n}: ${q.answer}→${final}`)
    q.answer = final
    q.verified = srcs.length === 0 ? undefined : (verified && !tie)
  })

  // 阅读
  paper.readings.forEach((r, ti) => {
    r.questions.forEach((q, i) => {
      const gi = ti * 5 + i
      const srcs = []
      if (pfo.reading[gi]) srcs.push({ src: 'pfoocc', ans: pfo.reading[gi] })
      if (web?.reading?.[gi]) srcs.push({ src: 'web', ans: web.reading[gi] })
      const { final, verified, tie } = adjudicate(year, 'reading', gi, q.answer, srcs)
      if (final !== q.answer) changes.push(`reading T${ti + 1} q${q.n}: ${q.answer}→${final}`)
      q.answer = final
      q.verified = srcs.length === 0 ? undefined : (verified && !tie)
    })
  })

  // 新题型（仅 web 源）
  if (web?.partB) {
    paper.partB.questions.forEach((q, i) => {
      const w = web.partB[i]
      if (w && w !== q.answer) {
        changes.push(`partB q${q.n}: ${q.answer}→${w} (web)`)
        q.answer = w
        q.verified = true
      } else if (w) q.verified = true
    })
  }

  writeFileSync(fp, JSON.stringify(paper))
  if (changes.length) report.push({ year, changes })
}

console.log('=== 裁决完成 ===')
for (const r of report) console.log(`${r.year}: ${r.changes.length} 处修正\n  ${r.changes.join('\n  ')}`)

// 存疑统计
let suspect = 0
for (let year = 2005; year <= 2025; year++) {
  const paper = JSON.parse(readFileSync(join(PAPERS, `${year}.json`), 'utf8'))
  const all = [...paper.cloze.questions, ...paper.readings.flatMap(r => r.questions)]
  const s = all.filter(q => q.verified === false).length
  if (s) console.log(`⚠ ${year} 存疑 ${s} 题`)
  suspect += s
}
console.log(`总存疑: ${suspect}`)
