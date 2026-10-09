import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Link } from 'react-router-dom'
import { loadPaper, parsePaperId } from '../lib/content'
import type { Paper } from '../types'
import { QuestionCard } from '../components/QuestionCard'

const SEC_LABEL: Record<string, string> = { cloze: '完形', reading: '阅读', partB: '新题型' }

export function Mistakes() {
  const wrongs = useLiveQuery(() => db.answers.filter((a) => a.correct === false).toArray(), [])
  const [filter, setFilter] = useState<'all' | 'cloze' | 'reading' | 'partB'>('all')
  const [openQ, setOpenQ] = useState<{ paper: Paper; paperId: string; section: 'cloze' | 'reading' | 'partB'; textNo: number; qn: number } | null>(null)

  const list = (wrongs || []).filter((a) => filter === 'all' || a.section === filter)
    .sort((a, b) => b.doneAt - a.doneAt)

  const findQ = async (paperId: string, section: string, textNo: number, qn: number) => {
    const paper = await loadPaper(paperId)
    setOpenQ({ paper, paperId, section: section as 'cloze', textNo, qn })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-black text-slate-900">错题本</h1>
      <div className="mt-3 flex gap-2">
        {(['all', 'cloze', 'reading', 'partB'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${filter === f ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300'}`}>
            {f === 'all' ? `全部 ${wrongs?.length || 0}` : `${SEC_LABEL[f]} ${wrongs?.filter((a) => a.section === f).length || 0}`}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {list.map((a) => {
          let parsed: { year: number; examSet: 1 | 2 } = { year: 0, examSet: 1 }
          try { parsed = parsePaperId(a.paperId) } catch { /* 旧记录 */ }
          const { year, examSet } = parsed
          return (
            <button key={a.id} onClick={() => findQ(a.paperId, a.section, a.textNo || 0, a.qn)}
              className="card card-hover flex w-full items-center gap-3 p-3.5 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-sm font-bold text-red-500">✗</span>
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {year} 英语{examSet === 2 ? '二' : '一'} · {SEC_LABEL[a.section] || a.section}{a.section === 'reading' ? ` Text ${a.textNo}` : ''} · 第 {a.qn} 题
                </div>
                <div className="text-xs text-slate-400">你选了 {a.choice} · {new Date(a.doneAt).toLocaleDateString('zh-CN')}</div>
              </div>
              <span className="ml-auto text-xs font-medium text-slate-400">重做 →</span>
            </button>
          )
        })}
        {wrongs && !list.length && (
          <div className="card py-12 text-center">
            <div className="text-4xl">🎉</div>
            <div className="mt-2 text-slate-500">没有错题，继续保持！</div>
          </div>
        )}
      </div>

      {openQ && <RedoDialog {...openQ} onClose={() => setOpenQ(null)} />}
    </div>
  )
}

function RedoDialog({ paper, paperId, section, textNo, qn, onClose }: { paper: Paper; paperId: string; section: 'cloze' | 'reading' | 'partB'; textNo: number; qn: number; onClose: () => void }) {
  let stem = '', options = null as any, answer = '', explanation = '', verified = false
  if (section === 'cloze') {
    const q = paper.cloze.questions.find((x) => x.n === qn)!
    options = q.options; answer = q.answer; explanation = q.explanation; verified = q.verified ?? true
  } else if (section === 'reading') {
    const q = paper.readings.find((x) => x.no === textNo)!.questions.find((x) => x.n === qn)!
    stem = q.stem; options = q.options; answer = q.answer; explanation = q.explanation; verified = q.verified ?? true
  } else {
    const q = paper.partB.questions.find((x) => x.n === qn)!
    stem = q.stem; options = paper.partB.options; answer = q.answer; explanation = q.explanation
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div className="anim-in safe-bottom max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center">
          <span className="text-sm font-semibold text-slate-600">{paper.year} 英语{paper.examSet === 2 ? '二' : '一'} · 错题重做</span>
          <Link className="ml-3 text-xs text-indigo-600 hover:underline" to={`/paper/${paperId}`}>去试卷 →</Link>
          <button className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" onClick={onClose}>✕</button>
        </div>
        <QuestionCard paperId={paperId} section={section} textNo={textNo} qn={qn} stem={stem} options={options} answer={answer} explanation={explanation} verified={verified} />
        <div className="mt-2 text-center">
          <button className="text-xs text-slate-400 hover:text-indigo-600"
            onClick={async () => { await db.answers.where('[paperId+section+textNo+qn]').equals([paperId, section, textNo, qn]).delete(); onClose() }}>
            清除该题作答记录
          </button>
        </div>
      </div>
    </div>
  )
}
