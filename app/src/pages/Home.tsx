import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadIndex } from '../lib/content'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { IndexEntry } from '../types'

const SECS = [
  { key: 'cloze', label: '完形' },
  { key: 'reading', label: '阅读' },
  { key: 'partB', label: '新题型' },
  { key: 'translation', label: '翻译' }
] as const

export function Home() {
  const [index, setIndex] = useState<IndexEntry[] | null>(null)
  const [set, setSet] = useState<1 | 2>(1)
  const answers = useLiveQuery(() => db.answers.toArray(), [])
  const words = useLiveQuery(() => db.words.toArray(), [])
  const annotations = useLiveQuery(() => db.annotations.toArray(), [])

  useEffect(() => { loadIndex().then(setIndex).catch(() => setIndex([])) }, [])

  const byKey = new Map<string, { done: number; correct: number }>()
  for (const a of answers || []) {
    const k = `${a.paperId}:${a.section === 'reading' ? `r${a.textNo}` : a.section}`
    const s = byKey.get(k) || { done: 0, correct: 0 }
    s.done++
    if (a.correct) s.correct++
    byKey.set(k, s)
  }

  const papers = (index || []).filter(e => e.examSet === set).sort((a, b) => b.year - a.year)
  const totalDone = answers?.length || 0
  const totalCorrect = answers?.filter(a => a.correct).length || 0
  const dueWords = words?.filter(w => w.srs.due <= Date.now()).length || 0

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      {/* Hero */}
      <div className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-sky-500 p-6 text-white shadow-lg shadow-indigo-200 sm:p-8">
        <h1 className="text-2xl font-black tracking-wide sm:text-3xl">考研英语真题题库</h1>
        <p className="mt-1.5 text-sm text-indigo-100">
          英语一 2005–2025 · 21 套 &nbsp;/&nbsp; 英语二 2010–2025 · 16 套<br className="sm:hidden" />
          <span className="hidden sm:inline">客观题作答 · 逐题精解 · 生词标注 · 单词本 · 批注</span>
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <HeroStat label="已做题数" value={String(totalDone)} sub={totalDone ? `正确率 ${Math.round((totalCorrect / totalDone) * 100)}%` : '开始你的第一题'} />
          <HeroStat label="单词本" value={String(words?.length || 0)} sub={dueWords ? `${dueWords} 个待复习` : '无待复习'} />
          <HeroStat label="批注" value={String(annotations?.length || 0)} sub="点击查看" />
          <HeroStat label="错题" value={String(answers?.filter(a => a.correct === false).length || 0)} sub="可重做" />
        </div>
      </div>

      {/* 卷种切换 */}
      <div className="mt-6 flex items-center gap-2">
        <div className="flex rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {([1, 2] as const).map(s => (
            <button key={s} onClick={() => setSet(s)}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold transition-all ${set === s ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}>
              英语（{s === 1 ? '一' : '二'}）
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">{papers.length} 套</span>
        {set === 2 && <span className="chip bg-sky-50 text-sky-600">专硕 · 翻译为整段模式</span>}
      </div>

      {/* 试卷列表 */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {papers.map((e) => {
          const id = e.examSet === 2 ? `${e.year}-2` : String(e.year)
          const done = SECS.reduce((s, sec) => {
            if (sec.key === 'reading') {
              for (let t = 1; t <= 4; t++) s += byKey.get(`${id}:r${t}`)?.done || 0
            } else s += byKey.get(`${id}:${sec.key}`)?.done || 0
            return s
          }, 0)
          const objDone = SECS.reduce((s, sec) => {
            if (sec.key === 'translation') return s
            if (sec.key === 'reading') {
              for (let t = 1; t <= 4; t++) s += byKey.get(`${id}:r${t}`)?.done || 0
            } else s += byKey.get(`${id}:${sec.key}`)?.done || 0
            return s
          }, 0)
          const correct = SECS.reduce((s, sec) => {
            if (sec.key === 'reading') {
              for (let t = 1; t <= 4; t++) s += byKey.get(`${id}:r${t}`)?.correct || 0
            } else s += byKey.get(`${id}:${sec.key}`)?.correct || 0
            return s
          }, 0)
          const total = e.counts.cloze + e.counts.reading + e.counts.partB + e.counts.translation
          const objTotal = total - e.counts.translation
          const pct = objDone ? Math.round((correct / objDone) * 100) : null
          return (
            <Link key={id} to={`/paper/${id}?sec=cloze`} className="card card-hover group p-4">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black tabular-nums text-slate-900 group-hover:text-indigo-700">{e.year}</span>
                  <span className="text-xs font-medium text-slate-400">英语（{e.examSet === 2 ? '二' : '一'}）</span>
                </div>
                {pct != null && (
                  <span className={`chip ${pct >= 70 ? 'bg-emerald-50 text-emerald-600' : pct >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                    {pct}% 正确率
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {SECS.map((sec) => {
                  const d = sec.key === 'reading'
                    ? [1, 2, 3, 4].reduce((s, t) => s + (byKey.get(`${id}:r${t}`)?.done || 0), 0)
                    : byKey.get(`${id}:${sec.key}`)?.done || 0
                  const cnt = e.counts[sec.key as keyof typeof e.counts]
                  const full = d >= cnt
                  return (
                    <div key={sec.key} className={`rounded-lg px-1 py-1.5 text-center ${full ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                      <div className="text-[11px] text-slate-500">{sec.label}</div>
                      <div className={`text-sm font-bold tabular-nums ${full ? 'text-indigo-600' : d ? 'text-slate-700' : 'text-slate-400'}`}>{d}/{cnt}</div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-500" style={{ width: `${Math.min((done / total) * 100, 100)}%` }} />
              </div>
              <div className="mt-2 text-xs font-medium text-slate-400 transition-colors group-hover:text-indigo-600">
                {done ? '继续做题 →' : '开始做题 →'}
              </div>
            </Link>
          )
        })}
        {!index && <div className="text-slate-400">加载试卷索引…</div>}
        {index && !papers.length && <div className="text-slate-400">暂无试卷</div>}
      </div>
    </div>
  )
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
      <div className="text-[11px] font-medium uppercase tracking-wider text-indigo-100">{label}</div>
      <div className="mt-0.5 text-xl font-black tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-indigo-100/80">{sub}</div>}
    </div>
  )
}
