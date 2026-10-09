// 词汇管线：生成 common.json（常见词基准）+ glossary.json（释义词典）
// 基准 = google-10k 前5000 ∪ 考研大纲5530词（大纲词是考生应背的，不标提示）
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const D = join(ROOT, 'scripts', 'sources', 'dict')
const OUT = join(ROOT, 'app', 'public', 'content', 'vocab')

mkdirSync(OUT, { recursive: true })

// ---- google 10k 前 5000 ----
const g10k = readFileSync(join(D, 'google-10k.txt'), 'utf8').split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean)
const common = new Set(g10k.slice(0, 5000))

// ---- 考研大纲 5530（词频排序表）----
const netem = JSON.parse(readFileSync(join(D, 'netem_full_list.json'), 'utf8'))
const netemList = netem['5530考研词汇词频排序表'] || []
const netemGloss = new Map()
for (const item of netemList) {
  const w = String(item['单词'] || '').toLowerCase().trim()
  if (!w) continue
  common.add(w)
  if (item['其他拼写']) for (const alt of String(item['其他拼写']).split(/[;；,，]/)) { const a = alt.trim().toLowerCase(); if (a) common.add(a) }
  // 释义整理：netem 释义顿号分隔，质量一般，作兜底
  if (item['释义'] && !netemGloss.has(w)) {
    netemGloss.set(w, String(item['释义']).split(/[;；]/).slice(0, 3).join('；'))
  }
}
console.log('common size:', common.size, '(google5000 + netem', netemList.length + ')')

// ---- 常见不规则变形（保证 lemmatize 命中）----
const IRREG = {
  went: 'go', gone: 'go', was: 'be', were: 'be', been: 'be', is: 'be', are: 'be', am: 'be',
  men: 'man', women: 'woman', children: 'child', mice: 'mouse', feet: 'foot', teeth: 'tooth',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad', said: 'say', says: 'say',
  made: 'make', making: 'make', took: 'take', taking: 'take', given: 'give', giving: 'give',
  found: 'find', told: 'tell', held: 'hold', kept: 'keep', left: 'leave', felt: 'feel',
  grew: 'grow', growth: 'grow', knew: 'know', known: 'know', brought: 'bring', thought: 'think',
  ran: 'run', running: 'run', came: 'come', comes: 'come', coming: 'come', became: 'become', becomes: 'become',
  got: 'get', gets: 'get', getting: 'get', began: 'begin', begun: 'begin', spoke: 'speak', spoken: 'speak',
  wrote: 'write', written: 'write', broke: 'break', broken: 'break', chose: 'choose', chosen: 'choose',
  drove: 'drive', driven: 'drive', drew: 'draw', drawn: 'draw', fell: 'fall', fallen: 'fall',
  rose: 'rise', risen: 'rise', raised: 'raise', lost: 'lose', losing: 'lose', paid: 'pay',
  sold: 'sell', sent: 'send', sent: 'send', spent: 'spend', built: 'build', sat: 'sit', stood: 'stand', understood: 'understand'
}
for (const base of new Set(Object.values(IRREG))) common.add(base)

// ---- kaoyan1_dict（6673 真题词，主释义源）----
const dict = JSON.parse(readFileSync(join(D, 'kaoyan1_dict.json'), 'utf8'))
const glossary = {}
let nDict = 0
for (const [k, v] of Object.entries(dict.entries || {})) {
  const w = k.toLowerCase().trim()
  if (!w || w.length > 40) continue
  glossary[w] = {
    ph: v.phonetic || undefined,
    pos: (v.definition_cn || '').match(/^([a-z]+\.\s)/)?.[1]?.trim(),
    g: v.definition_cn || ''
  }
  nDict++
}
// netem 释义兜底（dict 没有的）
let nNetem = 0
for (const [w, g] of netemGloss) {
  if (!glossary[w] && g) { glossary[w] = { g }; nNetem++ }
}
console.log('glossary entries:', Object.keys(glossary).length, `(dict ${nDict} + netem兜底 ${nNetem})`)

writeFileSync(join(OUT, 'common.json'), JSON.stringify([...common]))
writeFileSync(join(OUT, 'glossary.json'), JSON.stringify(glossary))

// ---- 裁剪版 glossary（发布用）：只保留 37 套真题文本中实际出现的词，满足单文件 <1MB ----
{
  const lemmaLite = (w) => {
    if (w.length <= 3) return w
    for (const [re, rep] of [[/ies$/, 'y'], [/ves$/, 'f'], [/([sxz]|ch|sh)es$/, '$1'], [/s$/, ''],
      [/ying$/, 'y'], [/(.)\1ing$/, '$1'], [/ing$/, ''], [/ied$/, 'y'], [/(.)\1ed$/, '$1'], [/ed$/, ''],
      [/ier$/, 'y'], [/iest$/, 'y']]) {
      if (re.test(w)) { const c = w.replace(re, rep); if (c.length >= 3) return c }
    }
    return w
  }
  const corpus = new Set()
  const PAPERS = join(ROOT, 'content', 'papers')
  for (const f of readdirSync(PAPERS)) {
    if (!f.endsWith('.json')) continue
    const p = JSON.parse(readFileSync(join(PAPERS, f), 'utf8'))
    const texts = [
      ...p.cloze.paragraphs, ...p.cloze.questions.flatMap(q => [...Object.values(q.options), q.explanation]),
      ...p.readings.flatMap(r => [...r.paragraphs, ...r.questions.flatMap(q => [q.stem, ...Object.values(q.options), q.explanation])]),
      ...p.partB.paragraphs, ...Object.values(p.partB.options), ...p.partB.questions.map(q => q.explanation),
      ...p.translation.paragraphs, ...p.translation.sentences.flatMap(s => [s.text, s.explanation])
    ].join('\n').toLowerCase()
    for (const m of texts.match(/[a-z][a-z'’-]*/g)) {
      corpus.add(m)
      corpus.add(lemmaLite(m))
    }
  }
  const trimmed = {}
  for (const [w, v] of Object.entries(glossary)) {
    if (corpus.has(w)) {
      trimmed[w] = {
        ph: v.ph,
        pos: v.pos,
        g: v.g.length > 60 ? v.g.slice(0, 60) + '…' : v.g
      }
    }
  }
  writeFileSync(join(OUT, 'glossary-trimmed.json'), JSON.stringify(trimmed))
  console.log(`glossary 裁剪版: ${Object.keys(trimmed).length} 词条，磁盘 ${Math.round(readFileSync(join(OUT, 'glossary-trimmed.json')).length / 1024)}KB（全量 ${Object.keys(glossary).length}）`)
}

// ---- sanity check：真题文本生词比例 ----
const WORD = /[A-Za-z][A-Za-z'’-]*/g
const lemma = (w) => {
  if (IRREG[w]) return IRREG[w]
  if (w.length <= 3) return w
  for (const [re, rep] of [[/ies$/, 'y'], [/ves$/, 'f'], [/([sxz]|ch|sh)es$/, '$1'], [/s$/, ''],
    [/ying$/, 'y'], [/(.)\1ing$/, '$1'], [/ing$/, ''], [/ied$/, 'y'], [/(.)\1ed$/, '$1'], [/ed$/, ''],
    [/ier$/, 'y'], [/iest$/, 'y'], [/er$/, ''], [/est$/, '']]) {
    if (re.test(w)) { const c = w.replace(re, rep); if (c.length >= 2) return c }
  }
  return w
}
const hintWords = new Map()
for (const f of readdirSync(join(ROOT, 'content', 'papers'))) {
  if (!f.endsWith('.json')) continue
  const p = JSON.parse(readFileSync(join(ROOT, 'content', 'papers', f), 'utf8'))
  const texts = [
    ...p.cloze.paragraphs, ...p.cloze.questions.flatMap(q => Object.values(q.options)),
    ...p.readings.flatMap(r => [...r.paragraphs, ...r.questions.flatMap(q => [q.stem, ...Object.values(q.options)])]),
    ...p.partB.paragraphs, ...Object.values(p.partB.options)
  ].join('\n')
  for (const m of texts.matchAll(WORD)) {
    const l = lemma(m[0].toLowerCase())
    if (!common.has(l)) hintWords.set(l, (hintWords.get(l) || 0) + 1)
  }
}
const totalUnique = hintWords.size
console.log(`生词候选（全部真题去重）: ${totalUnique} 个；有释义的: ${[...hintWords.keys()].filter(w => glossary[w]).length}`)
const top = [...hintWords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
console.log('最高频生词样例:', top.map(([w, c]) => `${w}(${c})`).join(' '))
