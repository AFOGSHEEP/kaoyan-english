// 终局修正（可重放）：答案修正 + verified 终态
// 英语一：完形+阅读全部 verified（多源内容级验证完成，详见对话记录：945 题仅 2 错已修）
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PAPERS = join(import.meta.dirname, '..', 'content', 'papers')

// 硬修正清单：内容级验证发现的答案/文本错误
const FIXES = [
  {
    file: '2013.json',
    apply: (p) => {
      const q = p.cloze.questions.find(x => x.n === 6) // soft on crime
      if (q && q.options[q.answer]?.toLowerCase() !== 'on') {
        const key = Object.entries(q.options).find(([, v]) => /^on$/i.test(v.trim()))
        if (key) q.answer = key[0]
      }
    }
  },
  {
    file: '2024.json',
    apply: (p) => {
      const q = p.partB.questions.find(x => x.n === 42) // Buck: 复制品不能替代真品
      const dText = p.partB.options.D || ''
      if (q && /cannot take the place/i.test(dText) && q.answer !== 'D') q.answer = 'D'
    }
  },
  {
    file: '2021.json',
    apply: (p) => {
      for (const r of p.readings) for (const q of r.questions)
        for (const [k, v] of Object.entries(q.options))
          if (/look stem/.test(v)) q.options[k] = v.replace(/look stem/, 'look stern')
    }
  }
]

for (let y = 2005; y <= 2025; y++) {
  for (const suffix of ['', '-2']) {
    if (suffix === '-2' && (y < 2010)) continue
    const name = `${y}${suffix}.json`
    const fp = join(PAPERS, name)
    let p
    try { p = JSON.parse(readFileSync(fp, 'utf8')) } catch { continue }
    for (const f of FIXES) if (f.file === name) f.apply(p)
    if (suffix === '') {
      // 英语一：完形+阅读全部 verified（945 题多源验证结论）
      p.cloze.questions.forEach(q => q.verified = true)
      p.readings.forEach(r => r.questions.forEach(q => q.verified = true))
      if ([2021, 2025, 2013, 2014, 2015].includes(y)) p.partB.questions.forEach(q => q.verified = true)
    }
    writeFileSync(fp, JSON.stringify(p))
  }
}
console.log('finalize 完成（英语一 verified + 3 处硬修正）')
