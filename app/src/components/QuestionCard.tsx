import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Options } from '../types'
import { saveAnswer } from '../lib/answers'
import { useSettings } from '../stores/settings'
import { mdToHtml } from '../lib/md'
import { logEvent } from '../lib/logger'

interface Props {
  paperId: string
  section: 'cloze' | 'reading' | 'partB'
  textNo: number
  qn: number
  stem?: string
  options: Options | null
  answer: string
  explanation: string
  verified?: boolean
  onAnswered?: (correct: boolean) => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

export function QuestionCard({ paperId, section, textNo, qn, stem, options, answer, explanation, verified, onAnswered }: Props) {
  const { mode } = useSettings()
  const rec = useLiveQuery(
    () => db.answers.where('[paperId+section+textNo+qn]').equals([paperId, section, textNo, qn]).first(),
    [paperId, section, textNo, qn]
  )
  const showResult = !!rec && mode === 'practice'
  const correct = rec?.correct === true
  const wrong = rec?.correct === false

  const pick = async (letter: string) => {
    if (rec && mode === 'practice') return
    const ok = letter.toUpperCase() === answer.toUpperCase()
    await saveAnswer({ paperId, section, textNo, qn, choice: letter, correctAnswer: answer, mode })
    logEvent({ type: 'answer', paperId, section, qn, detail: `选${letter} ${ok ? '✓' : '✗ 答案' + answer}` })
    if (mode === 'practice') logEvent({ type: 'explain_view', paperId, section, qn })
    onAnswered?.(ok)
  }

  return (
    <div className="card p-4">
      <div className="mb-2.5 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">{qn}</span>
        {stem && <div className="reading-text flex-1 whitespace-pre-wrap font-medium text-slate-900">{stem}</div>}
      </div>

      {options && (
        <div className="space-y-2">
          {LETTERS.filter((l) => options[l] !== undefined).map((l) => {
            const chosen = rec?.choice === l
            const isAns = l === answer.toUpperCase()
            let cls = ''
            if (showResult && isAns) cls = 'right'
            else if (showResult && chosen && !isAns) cls = 'wrong'
            else if (chosen && !showResult) cls = 'chosen'
            return (
              <button key={l} onClick={() => pick(l)} disabled={!!rec && mode === 'practice'} className={`opt-btn ${cls}`}>
                <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold
                  ${showResult && isAns ? 'border-green-600 bg-green-600 text-white'
                    : showResult && chosen ? 'border-red-500 bg-red-500 text-white'
                    : chosen ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 text-slate-500'}`}>{l}</span>
                <span className="reading-text flex-1 text-slate-800">{options[l]}</span>
                {showResult && isAns && <span className="ml-1 shrink-0 text-xs font-bold text-green-600">✓</span>}
                {showResult && chosen && !isAns && <span className="ml-1 shrink-0 text-xs font-bold text-red-500">✗</span>}
              </button>
            )
          })}
        </div>
      )}

      {showResult && (
        <div className={`anim-in mt-3 rounded-xl border p-3.5 text-sm
          ${correct ? 'border-green-200 bg-green-50/70' : wrong ? 'border-red-200 bg-red-50/70' : 'border-slate-200 bg-slate-50'}`}>
          <div className="mb-1.5 font-bold">
            {correct ? '✓ 回答正确' : wrong ? `✗ 回答错误 · 正确答案 ${answer}` : '已作答'}
            {verified === false && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-700">答案存疑</span>}
          </div>
          <div className="max-h-[46dvh] overflow-y-auto pr-1 text-slate-700" dangerouslySetInnerHTML={{ __html: mdToHtml(explanation) }} />
        </div>
      )}

      {rec && mode === 'practice' && (
        <div className="mt-2 text-right">
          <button className="text-xs text-slate-400 transition hover:text-indigo-600"
            onClick={async () => { await db.answers.where('[paperId+section+textNo+qn]').equals([paperId, section, textNo, qn]).delete() }}>
            ↻ 重做本题
          </button>
        </div>
      )}
    </div>
  )
}
