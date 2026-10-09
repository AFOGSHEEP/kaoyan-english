import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { PaperViewProps } from '../pages/PaperView'
import { saveAnswer } from '../lib/answers'
import { mdToHtml } from '../lib/md'
import { InteractiveText } from '../components/InteractiveText'
import { logEvent } from '../lib/logger'

// 划线句在原文中标记渲染（英语一 5 句模式）
function renderPassageWithMarks(
  paragraphs: string[],
  sentences: { n: number; text: string }[],
  onOpen: (n: number) => void
): React.ReactNode[] {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return paragraphs.map((para, pi) => {
    const marks: { n: number; re: RegExp }[] = []
    for (const s of sentences) marks.push({ n: s.n, re: new RegExp(esc(s.text).split(/\\?\s+/).join('\\s+')) })
    const nodes: React.ReactNode[] = []
    let rest = para
    let key = 0
    for (const m of marks) {
      const idx = rest.search(m.re)
      if (idx === -1) continue
      const match = rest.slice(idx).match(m.re)![0]
      nodes.push(<span key={key++}>{rest.slice(0, idx)}</span>)
      nodes.push(
        <span key={key++} className="cursor-pointer rounded-sm border-b-2 border-indigo-500 bg-indigo-50/70 px-0.5 transition-colors hover:bg-indigo-100"
          onClick={(e) => { e.stopPropagation(); onOpen(m.n) }}>
          <sup className="mr-0.5 text-[10px] font-bold text-indigo-600">{m.n}</sup>{match}
        </span>
      )
      rest = rest.slice(idx + match.length)
    }
    nodes.push(<span key={key++}>{rest}</span>)
    return <p key={pi} className="mb-4">{nodes}</p>
  })
}

export function TranslationView({ paper, paperId }: PaperViewProps) {
  const tr = paper.translation
  const isFull = tr.variant === 'full'
  const [open, setOpen] = useState<number | null>(isFull ? tr.sentences[0]?.n ?? null : null)
  const [myTrans, setMyTrans] = useState<Record<number, string>>({})
  const answers = useLiveQuery(() => db.answers.where('paperId').equals(paperId).and((a) => a.section === 'translation').toArray(), [paperId]) || []
  const byQ = new Map(answers.map((a) => [a.qn, a]))

  const sentenceOf = (n: number) => tr.sentences.find((s) => s.n === n)!

  return (
    <div>
      <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs leading-relaxed text-slate-500">
        <span className="font-semibold text-indigo-600">翻译</span> · {isFull ? '整段英译汉 · 15 分' : '5 个划线句 · 每句 2 分'}
        <span className="ml-2 text-slate-400">{isFull ? '阅读原文后在下方输入译文，对照参考译文并自评' : '点击原文中划线句开始，逐句对照参考译文并自评'}</span>
      </div>

      <div className="card px-5 py-4 sm:px-6">
        <div className="reading-text text-slate-800">
          {isFull
            ? <InteractiveText paperId={paperId} section="translation" paragraphs={tr.paragraphs} />
            : renderPassageWithMarks(tr.paragraphs, tr.sentences, (n) => setOpen(n))}
        </div>
      </div>

      {/* 完成状态卡（句子模式） / 整段入口（full 模式） */}
      <div className={`mt-5 grid gap-2 ${isFull ? '' : 'grid-cols-5'}`}>
        {tr.sentences.map((s) => {
          const rec = byQ.get(s.n)
          return (
            <button key={s.n} onClick={() => setOpen(s.n)}
              className={`card card-hover p-2.5 text-center text-xs ${rec ? 'border-indigo-200 bg-indigo-50/60 text-indigo-700' : 'text-slate-500'} ${isFull ? 'flex items-center justify-center gap-2' : ''}`}>
              <div className="font-bold">{s.n}</div>
              <div>{rec ? `自评 ${rec.choice} 分` : isFull ? '去翻译 →' : '未完成'}</div>
            </button>
          )
        })}
      </div>

      {open != null && (
        <TransDialog
          key={open}
          n={open}
          full={isFull}
          text={sentenceOf(open).text}
          reference={sentenceOf(open).reference}
          explanation={sentenceOf(open).explanation}
          points={sentenceOf(open).points as { frag: string; score: number }[] | undefined}
          myTrans={myTrans[open] || ''}
          onMyTrans={(v) => setMyTrans((m) => ({ ...m, [open]: v }))}
          selfScore={byQ.get(open)?.choice}
          onSelfScore={async (score) => {
            await saveAnswer({ paperId, section: 'translation', textNo: 0, qn: open, choice: score, correctAnswer: '', mode: 'practice' })
            logEvent({ type: 'trans_self', paperId, section: 'translation', qn: open, detail: `自评${score}分` })
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

function TransDialog(props: {
  n: number; full: boolean; text: string; reference: string; explanation: string
  points?: { frag: string; score: number }[]
  myTrans: string; onMyTrans: (v: string) => void
  selfScore?: string; onSelfScore: (s: string) => void
  onClose: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const scoreOptions = props.full ? [['8', '尚需打磨'], ['11', '基本达意'], ['14', '流畅准确']] : [['0', '没译好'], ['1', '部分到位'], ['2', '基本达标']]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] p-0 sm:items-center sm:p-6" onClick={props.onClose}>
      <div className="anim-in safe-bottom max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">{props.n}</span>
          <span className="text-sm font-semibold text-slate-500">{props.full ? '整段翻译' : '翻译原句'}</span>
          <button className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100" onClick={props.onClose}>✕</button>
        </div>
        <div className={`reading-text rounded-xl bg-slate-50 p-3.5 text-slate-900 ${props.full ? 'max-h-48 overflow-y-auto' : ''}`}>{props.text}</div>

        <div className="mt-3">
          <div className="mb-1 text-sm font-semibold text-slate-500">你的译文（可选）</div>
          <textarea className="h-24 w-full rounded-xl border border-slate-200 p-2.5 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="写下你的译文（也可以只在心里翻译）"
            value={props.myTrans} onChange={(e) => props.onMyTrans(e.target.value)} />
        </div>

        {!revealed ? (
          <button className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            onClick={() => setRevealed(true)}>
            对照参考译文与解析
          </button>
        ) : (
          <>
            <div className="mt-3">
              <div className="mb-1 text-sm font-bold text-green-700">参考译文</div>
              <div className="rounded-xl border border-green-200 bg-green-50/70 p-3.5 text-sm leading-relaxed text-slate-800">{props.reference}</div>
            </div>
            {props.points && props.points.length >= 2 && (
              <div className="mt-3">
                <div className="mb-1 text-sm font-bold text-indigo-600">采分点</div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                  {props.points.map((p, i) => (
                    <div key={i} className="flex items-baseline gap-2 py-0.5 text-sm">
                      <span className="chip bg-indigo-600 text-white" style={{ minWidth: '2.6em', justifyContent: 'center' }}>{p.score}分</span>
                      <span className="text-slate-700">{p.frag.replace(/^>\s*\*\*答案：?\*\*\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3">
              <div className="mb-1 text-sm font-bold text-slate-600">解析（句构分析与翻译要点）</div>
              <div className="max-h-64 overflow-y-auto rounded-xl bg-slate-50 p-3.5 text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: mdToHtml(props.explanation) }} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">自评：</span>
              {scoreOptions.map(([v, label]) => (
                <button key={v} onClick={() => props.onSelfScore(v)}
                  className={`rounded-xl border-2 px-3 py-1.5 text-sm transition active:scale-95 ${props.selfScore === v ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700' : 'border-slate-200 hover:border-slate-400'}`}>
                  {v} 分 · {label}
                </button>
              ))}
              <button className="btn-primary ml-auto" onClick={props.onClose}>完成</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
