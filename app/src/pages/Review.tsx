import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { WordEntry } from '../types'
import { srsGrade } from '../lib/text'
import { logEvent } from '../lib/logger'
import { Link } from 'react-router-dom'

export function Review() {
  const words = useLiveQuery(() => db.words.toArray(), [])
  const due = (words || []).filter((w) => w.srs.due <= Date.now()).sort((a, b) => a.srs.due - b.srs.due)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const cur: WordEntry | undefined = due[idx]

  useEffect(() => { setFlipped(false) }, [idx])

  const grade = async (g: 'again' | 'hard' | 'good') => {
    if (!cur) return
    await db.words.update(cur.id!, { srs: srsGrade(cur.srs, g), updatedAt: Date.now() })
    logEvent({ type: 'word_review', detail: `${cur.word}:${g}` })
    setIdx((i) => i) // due 列表会因更新而变化，指针保持
  }

  if (!words) return <div className="p-8 text-center text-slate-400">加载中…</div>

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">复习</h1>
        <span className="text-sm text-slate-400">{due.length} 个到期</span>
        <Link to="/words" className="ml-auto text-sm text-slate-400 hover:text-slate-600">← 单词本</Link>
      </div>

      {!cur ? (
        <div className="mt-16 text-center">
          <div className="text-5xl">🎉</div>
          <div className="mt-3 text-slate-500">当前没有到期的单词</div>
          <div className="mt-1 text-sm text-slate-400">去 <Link className="text-blue-600 hover:underline" to="/">试卷</Link> 里多收几个生词吧</div>
        </div>
      ) : (
        <>
          <div className="mt-2 text-xs text-slate-400">剩余 {due.length - idx} 张卡 · 复习 {Math.min(idx + 1, due.length)}/{due.length}</div>
          <div onClick={() => setFlipped(!flipped)}
            className="mt-3 flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-slate-200 bg-white p-6 text-center shadow-sm active:scale-[0.99]">
            <div className="text-3xl font-bold text-slate-900">{cur.word}</div>
            {cur.phonetic && <div className="mt-1 text-slate-400">{cur.phonetic}</div>}
            {flipped ? (
              <div className="mt-4 space-y-2">
                {cur.gloss && <div className="text-slate-700">{cur.gloss}</div>}
                {cur.notes && <div className="text-sm text-amber-700">📝 {cur.notes}</div>}
                {cur.examples[0] && <div className="text-sm italic text-slate-500">"{cur.examples[0].en.slice(0, 140)}"</div>}
              </div>
            ) : (
              <div className="mt-6 text-xs text-slate-400">点击卡片查看释义（已复习 {cur.srs.reps} 次）</div>
            )}
          </div>
          {flipped && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={() => grade('again')} className="rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white">😵 不认识</button>
              <button onClick={() => grade('hard')} className="rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white">🤔 模糊</button>
              <button onClick={() => grade('good')} className="rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white">😀 认识</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
