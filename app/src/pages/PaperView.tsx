import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { loadPaper, parsePaperId } from '../lib/content'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useSettings } from '../stores/settings'
import type { Paper, SectionId } from '../types'
import { ClozeView } from '../views/ClozeView'
import { ReadingView } from '../views/ReadingView'
import { PartBView } from '../views/PartBView'
import { TranslationView } from '../views/TranslationView'
import { QuestionCard } from '../components/QuestionCard'

export interface PaperViewProps {
  paper: Paper
  paperId: string
  activeQ: number | null
  setActiveQ: (n: number | null) => void
  focusAnnotationId?: number | null
}

export function PaperView() {
  const { id } = useParams()
  const paperId = id || '2023'
  const { examSet } = parsePaperId(paperId)
  const [sp, setSp] = useSearchParams()
  const [paper, setPaper] = useState<Paper | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [activeQ, setActiveQ] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const { mode, setMode, fontSize, setFontSize } = useSettings()

  const section = (sp.get('sec') || 'cloze') as SectionId
  const text = +(sp.get('text') || 1)

  useEffect(() => {
    loadPaper(paperId).then(setPaper).catch((e) => setErr(String(e.message)))
  }, [paperId])

  useEffect(() => {
    document.documentElement.style.setProperty('--reading-font-size', `${fontSize}px`)
  }, [fontSize])

  const answers = useLiveQuery(() => db.answers.where('paperId').equals(paperId).toArray(), [paperId])
  const focusAnnotationId = sp.get('annot') ? +sp.get('annot')! : null

  const secTabs = useMemo(() => {
    if (!paper) return []
    return [
      { key: 'cloze', label: '完形', qs: paper.cloze.questions.map((q) => q.n), textParam: null },
      ...paper.readings.map((r) => ({ key: 'reading', label: `阅读 ${r.no}`, qs: r.questions.map((q) => q.n), textParam: r.no })),
      { key: 'partB', label: '新题型', qs: paper.partB.questions.map((q) => q.n), textParam: null },
      { key: 'translation', label: '翻译', qs: paper.translation.sentences.map((q) => q.n), textParam: null }
    ]
  }, [paper])

  if (err) return <div className="p-8 text-center text-red-600">加载失败：{err}</div>
  if (!paper) return <div className="p-8 text-center text-slate-400">加载中…</div>

  const go = (sec: string, textParam: number | null) => {
    const p = new URLSearchParams()
    p.set('sec', sec)
    if (textParam) p.set('text', String(textParam))
    setSp(p)
    setActiveQ(null)
    setPanelOpen(true)
  }

  const viewProps: PaperViewProps = { paper, paperId, activeQ, setActiveQ, focusAnnotationId }
  const transTotal = paper.translation.sentences.length

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* 顶栏 */}
      <header className="z-20 flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/85 px-3 py-2 shadow-sm backdrop-blur-md">
        <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600" title="返回试卷库">←</Link>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-black tabular-nums text-slate-900">{paper.year}</span>
          <span className={`chip ${examSet === 2 ? 'bg-sky-100 text-sky-700' : 'bg-indigo-100 text-indigo-700'}`}>英语{examSet === 2 ? '二' : '一'}</span>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {secTabs.map((t, i) => {
            const active = section === t.key && (t.textParam == null || text === t.textParam)
            const done = answers?.filter((a) => a.section === t.key && (t.key !== 'reading' || a.textNo === t.textParam)).length || 0
            const full = done >= t.qs.length
            return (
              <button key={i} onClick={() => go(t.key, t.textParam)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all
                  ${active ? 'bg-slate-900 text-white shadow-sm' : full ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {t.label}
                <span className={`tabular-nums ${active ? 'text-slate-400' : 'text-slate-400'}`}>{done}/{t.qs.length}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMode(mode === 'practice' ? 'exam' : 'practice')}
            className={`chip transition-all ${mode === 'practice' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-orange-50 text-orange-700 ring-1 ring-orange-200'}`}
            title={mode === 'practice' ? '练习模式：即答即判并显示解析' : '模考模式：作答不即时判分'}>
            {mode === 'practice' ? '🖊 练习' : '📝 模考'}
          </button>
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 text-slate-500">
            <button className="px-2 py-0.5 text-xs hover:bg-slate-50" onClick={() => setFontSize(fontSize - 1)}>A−</button>
            <button className="border-x border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50" onClick={() => setFontSize(fontSize + 1)}>A＋</button>
          </div>
        </div>
      </header>

      {/* 主体 */}
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-5 pb-44 lg:pb-8">
            {section === 'cloze' && <ClozeView {...viewProps} />}
            {section === 'reading' && <ReadingView key={text} {...viewProps} textNo={text} />}
            {section === 'partB' && <PartBView {...viewProps} />}
            {section === 'translation' && <TranslationView {...viewProps} />}
          </div>
        </main>

        {/* 桌面题目栏 */}
        <aside className="hidden w-[400px] shrink-0 overflow-y-auto border-l border-slate-200/80 bg-white/60 p-3 lg:block">
          <QuestionSidebar {...viewProps} section={section} text={text} transTotal={transTotal} />
        </aside>
      </div>

      {/* 移动底部抽屉 */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className={`drawer-sheet bg-white shadow-[0_-6px_24px_rgba(0,0,0,0.10)] ${panelOpen ? 'max-h-[72dvh]' : 'max-h-12'}`}>
          <button className="flex w-full items-center justify-center py-2.5" onClick={() => setPanelOpen(!panelOpen)}>
            <span className="h-1.5 w-10 rounded-full bg-slate-300 transition-colors hover:bg-slate-400" />
          </button>
          <div className={`overflow-y-auto px-3 ${panelOpen ? 'max-h-[64dvh] pb-4' : 'hidden'}`}>
            <QuestionSidebar {...viewProps} section={section} text={text} transTotal={transTotal} />
          </div>
        </div>
      </div>
    </div>
  )
}

// 题目栏（桌面侧栏 & 移动抽屉共用）
function QuestionSidebar({ paper, paperId, section, text, activeQ, setActiveQ, transTotal }: PaperViewProps & { section: SectionId; text: number; transTotal: number }) {
  let items: { qn: number; stem?: string; options: any; answer: string; explanation: string; verified?: boolean }[] = []
  if (section === 'cloze') {
    items = paper.cloze.questions.map((q) => ({ qn: q.n, options: q.options, answer: q.answer, explanation: q.explanation, verified: q.verified }))
  } else if (section === 'reading') {
    const r = paper.readings.find((x) => x.no === text) || paper.readings[0]
    items = r.questions.map((q) => ({ qn: q.n, stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation, verified: q.verified }))
  } else if (section === 'partB') {
    items = paper.partB.questions.map((q) => ({ qn: q.n, stem: q.stem, options: paper.partB.options, answer: q.answer, explanation: q.explanation }))
  }

  if (section === 'translation') {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
        翻译题（{transTotal === 1 ? '整段' : '5 句'}）请在左侧作答
      </div>
    )
  }

  const cur = items.find((i) => i.qn === activeQ) || null
  return (
    <div>
      <div className="mb-3 grid grid-cols-10 gap-1">
        {items.map((i) => (
          <button key={i.qn} onClick={() => setActiveQ(i.qn)}
            className={`h-8 rounded-lg text-xs font-bold tabular-nums transition-all
              ${i.qn === activeQ ? 'bg-slate-900 text-white shadow-sm scale-105'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600'}`}>
            {i.qn}
          </button>
        ))}
      </div>
      {cur ? (
        <div className="anim-in">
          <QuestionCard paperId={paperId} section={section === 'reading' ? 'reading' : section} textNo={section === 'reading' ? text : 0}
            qn={cur.qn} stem={cur.stem} options={cur.options} answer={cur.answer} explanation={cur.explanation} verified={cur.verified} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-center text-sm text-slate-400">
          点击题号或<span className="mx-1 font-medium text-indigo-500">文中空位</span>开始答题
        </div>
      )}
    </div>
  )
}
