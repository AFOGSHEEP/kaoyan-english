import { InteractiveText } from '../components/InteractiveText'
import type { PaperViewProps } from '../pages/PaperView'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { saveAnswer } from '../lib/answers'
import { useSettings } from '../stores/settings'
import { mdToHtml } from '../lib/md'

const VARIANT_LABEL: Record<string, string> = {
  gapfill: '七选五 · 为每个空选择正确段落',
  ordering: '排序题 · 按 41-45 顺序选择正确段落',
  headings: '小标题匹配 · 为段落选择最合适的标题',
  matching: '观点匹配 · 为每段表述选择对应人物/来源'
}

export function PartBView({ paper, paperId, activeQ, setActiveQ }: PaperViewProps) {
  const pb = paper.partB
  const { mode } = useSettings()
  const answers = useLiveQuery(() => db.answers.where('paperId').equals(paperId).and((a) => a.section === 'partB').toArray(), [paperId]) || []
  const byQ = new Map(answers.map((a) => [a.qn, a]))
  const labels = Object.keys(pb.options)

  return (
    <div>
      <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs leading-relaxed text-slate-500">
        <span className="font-semibold text-indigo-600">新题型</span> · 5 题 · 每题 2 分 · {VARIANT_LABEL[pb.variant] || pb.variant}
      </div>

      {pb.paragraphs.length > 0 && (
        <div className="card px-5 py-4 sm:px-6">
          <InteractiveText paperId={paperId} section="partB" paragraphs={pb.paragraphs} />
        </div>
      )}
      {pb.paragraphs.length === 0 && pb.variant === 'ordering' && (
        <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-sm text-slate-400">
          排序题：原卷段落已全部打散为下方选项，按正确顺序为 41-45 选择
        </div>
      )}

      <div className="mt-4 space-y-2">
        {labels.map((l) => (
          <div key={l} className="card flex gap-2.5 p-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white">{l}</span>
            <div className="reading-text flex-1 text-slate-800">{pb.options[l]}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {pb.questions.map((q) => {
          const rec = byQ.get(q.n)
          const showResult = rec && mode === 'practice'
          return (
            <div key={q.n} className={`card p-3.5 ${activeQ === q.n ? 'ring-2 ring-indigo-400' : ''}`}>
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">{q.n}</span>
                {q.stem && <span className="line-clamp-1 flex-1 text-xs text-slate-500">{q.stem}</span>}
                {showResult && (rec!.correct
                  ? <span className="chip bg-green-50 text-green-600">✓ 正确</span>
                  : <span className="chip bg-red-50 text-red-500">✗ 答案 {q.answer}</span>)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const chosen = rec?.choice === l
                  const isAns = l === q.answer.toUpperCase()
                  let cls = 'border-slate-200 bg-white hover:border-indigo-400 hover:text-indigo-600'
                  if (showResult && isAns) cls = 'border-green-500 bg-green-50 text-green-700'
                  else if (showResult && chosen) cls = 'border-red-400 bg-red-50 text-red-500'
                  else if (chosen) cls = 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  return (
                    <button key={l} disabled={!!rec && mode === 'practice'}
                      onClick={async () => {
                        await saveAnswer({ paperId, section: 'partB', textNo: 0, qn: q.n, choice: l, correctAnswer: q.answer, mode })
                        setActiveQ(q.n)
                      }}
                      className={`h-9 w-9 rounded-xl border-2 text-sm font-bold transition-all active:scale-90 ${cls}`}>{l}</button>
                  )
                })}
              </div>
              {showResult && (
                <div className="anim-in mt-2.5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: mdToHtml(q.explanation) }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
