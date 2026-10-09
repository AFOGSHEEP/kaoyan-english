// 排列一致性检测：main options vs pfoocc options 逐题比对
// 排列一致 ⇒ web/pfoocc 字母可与 main 字母直接比较；排列不同 ⇒ 需内容对齐
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const PAPERS = join(ROOT, 'content', 'papers')
const ANS = join(ROOT, 'scripts', 'sources', 'answers')
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

function parseOptions(file) {
  try {
    const tex = readFileSync(file, 'utf8')
    return tex.split(/\\item/).slice(1).map(item => {
      const tasks = [...item.matchAll(/\\task\s+([^\n]+)/g)].map(m => norm(m[1]))
      return { A: tasks[0], B: tasks[1], C: tasks[2], D: tasks[3] }
    })
  } catch { return [] }
}

for (const year of [2013, 2014, 2015, 2016, 2017, 2020, 2021]) {
  const paper = JSON.parse(readFileSync(join(PAPERS, `${year}.json`), 'utf8'))
  // 完形
  const pc = parseOptions(join(ANS, String(year), 'cloze', 'options.tex'))
  let same = 0, diff = 0, miss = 0
  paper.cloze.questions.forEach((q, i) => {
    const p = pc[i]
    if (!p || !p.A) { miss++; return }
    if (['A', 'B', 'C', 'D'].every(l => norm(q.options[l]) === p[l])) same++
    else diff++
  })
  const clozeStat = `cloze same=${same} diff=${diff} miss=${miss}`
  // 阅读
  const rstats = []
  paper.readings.forEach((r, ti) => {
    const pr = parseOptions(join(ANS, String(year), 'read', `options${ti + 1}.tex`))
    let s2 = 0, d2 = 0, m2 = 0
    r.questions.forEach((q, idx) => {
      const p = pr[idx]
      if (!p || !p.A) { m2++; return }
      if (['A', 'B', 'C', 'D'].every(l => norm(q.options[l]) === p[l])) s2++
      else d2++
    })
    rstats.push(`T${ti + 1}:${s2}/${s2 + d2}${m2 ? `(-${m2})` : ''}`)
  })
  console.log(year, '|', clozeStat, '| reading:', rstats.join(' '))
}
