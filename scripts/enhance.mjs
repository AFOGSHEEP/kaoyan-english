// 增强：1) 翻译采分点从解析提取为结构化 points  2) 客观题解析尾部附加"本题生词"块（低频词+释义）
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const PAPERS = join(ROOT, 'content', 'papers')

// 词汇数据（与 build-vocab 相同来源）
const g10k = readFileSync(join(ROOT, 'scripts/sources/dict/google-10k.txt'), 'utf8').split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean)
const common = new Set(g10k.slice(0, 5000))
const netem = JSON.parse(readFileSync(join(ROOT, 'scripts/sources/dict/netem_full_list.json'), 'utf8'))['5530考研词汇词频排序表'] || []
for (const item of netem) {
  const w = String(item['单词'] || '').toLowerCase().trim()
  if (w) common.add(w)
  if (item['其他拼写']) for (const alt of String(item['其他拼写']).split(/[;；,，]/)) { const a = alt.trim().toLowerCase(); if (a) common.add(a) }
}
const dict = JSON.parse(readFileSync(join(ROOT, 'scripts/sources/dict/kaoyan1_dict.json'), 'utf8'))
const glossary = {}
for (const [k, v] of Object.entries(dict.entries || {})) {
  const w = k.toLowerCase().trim()
  if (w && w.length <= 40 && v.definition_cn) glossary[w] = { ph: v.phonetic, g: v.definition_cn }
}
const netemGloss = new Map(netem.map(i => [String(i['单词'] || '').toLowerCase(), i['释义']]).filter(x => x[0]))

const IRREG = { went:'go',gone:'go',was:'be',were:'be',been:'be',children:'child',men:'man',women:'woman',feet:'foot',better:'good',best:'good',said:'say',made:'make',took:'take',given:'give',found:'find',told:'tell',grew:'grow',knew:'know',known:'know',brought:'bring',thought:'think',ran:'run',came:'come',became:'become',got:'get',began:'begin',spoke:'speak',wrote:'write',broken:'break',drove:'drive',drew:'draw',fell:'fall',rose:'rise',lost:'lose',paid:'pay',built:'build',stood:'stand',understood:'understand' }
const lemma = (w) => {
  if (IRREG[w]) return IRREG[w]
  if (w.length <= 3) return w
  for (const [re, rep] of [[/ies$/,'y'],[/ves$/,'f'],[/([sxz]|ch|sh)es$/,'$1'],[/s$/,''],[/ying$/,'y'],[/(.)\1ing$/,'$1'],[/ing$/,''],[/ied$/,'y'],[/(.)\1ed$/,'$1'],[/ed$/,'']]) {
    if (re.test(w)) { const c = w.replace(re, rep); if (c.length >= 3) return c }
  }
  return w
}

function uncommonWithGloss(text, limit = 6) {
  const found = new Map()
  const seen = new Set()
  for (const m of text.match(/[A-Za-z][A-Za-z'’-]*/g)) {
    const raw = m.toLowerCase()
    const l = lemma(raw)
    if (raw.length <= 2 || seen.has(l) || seen.has(raw)) continue
    if (common.has(raw) || common.has(l)) continue
    const g = glossary[raw] || glossary[l]
    if (g) { seen.add(raw); seen.add(l); found.set(raw, { word: m, ph: g.ph, gloss: g.g }) }
    if (found.size >= limit) break
  }
  return [...found.values()]
}

let nPoints = 0, nVocabBlocks = 0

for (let year = 2005; year <= 2025; year++) {
  for (const suffix of ['', '-2']) {
    if (suffix === '-2' && year < 2010) continue
    const fp = join(PAPERS, `${year}${suffix}.json`)
    let paper
    try { paper = JSON.parse(readFileSync(fp, 'utf8')) } catch { continue }

  // ---- 1. 翻译采分点提取：解析中 “英文片段(0.5分)//英文片段(1 分)...” 模式 ----
  for (const s of paper.translation.sentences) {
    if (s.points?.length) continue
    const lines = s.explanation.split(/\n+/).filter(l => /\(\d+(?:\.\d+)?\s*分\)/.test(l) && /[A-Za-z]{6,}/.test(l))
    const target = lines[0] || ''
    const segs = target.split('//').map(t => t.trim()).filter(Boolean)
    const points = segs.map(seg => {
      const mm = seg.match(/^(.*?)\((\d+(?:\.\d+)?)\s*分\)$/) || seg.match(/^(.*?)\((\d+(?:\.\d+)?)\s*分\)/)
      if (mm) return { frag: mm[1].trim(), score: parseFloat(mm[2]) }
      return null
    }).filter(Boolean)
    if (points.length >= 2) {
      s.points = points
      nPoints++
    }
  }

  // ---- 2. 客观题解析附加生词块（原解析末尾追加，幂等：已有【生词】标记则跳过）----
  const appendVocab = (q, contextText) => {
    if (!q.explanation || q.explanation.includes('【生词】')) return
    const words = uncommonWithGloss(contextText, 6)
    if (!words.length) return
    const lines = words.map(w => `- **${w.word}**${w.ph ? ` /${w.ph}/` : ''}：${w.gloss.length > 60 ? w.gloss.slice(0, 60) + '…' : w.gloss}`).join('\n')
    q.explanation += `\n\n【生词】本题涉及的低频词：\n${lines}`
    nVocabBlocks++
  }

  // 完形：题干上下文 = 文章全文（空位词从选项出，选项词常见）
  const clozeText = paper.cloze.paragraphs.join(' ')
  paper.cloze.questions.forEach(q => appendVocab(q, clozeText))
  // 阅读：该篇文章
  paper.readings.forEach(r => {
    const t = r.paragraphs.join(' ')
    r.questions.forEach(q => appendVocab(q, t + ' ' + q.stem))
  })
  // 新题型：选项文本
  const pbText = Object.values(paper.partB.options).join(' ') + ' ' + paper.partB.paragraphs.join(' ')
  paper.partB.questions.forEach(q => appendVocab(q, pbText))
  // 翻译：原句
  paper.translation.sentences.forEach(s => appendVocab(s, s.text))

  writeFileSync(fp, JSON.stringify(paper))
  }
}

console.log(`翻译采分点提取: ${nPoints} 句`)
console.log(`解析生词块附加: ${nVocabBlocks} 题`)
