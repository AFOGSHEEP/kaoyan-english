import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { InteractiveText } from '../components/InteractiveText'
import type { PaperViewProps } from '../pages/PaperView'
import { useSettings } from '../stores/settings'

export function ClozeView({ paper, paperId, activeQ, setActiveQ, focusAnnotationId }: PaperViewProps) {
  const { mode } = useSettings()
  const answers = useLiveQuery(() => db.answers.where('paperId').equals(paperId).and((a) => a.section === 'cloze').toArray(), [paperId]) || []
  const byQ = new Map(answers.map((a) => [a.qn, a]))

  return (
    <div>
      <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs leading-relaxed text-slate-500">
        <span className="font-semibold text-indigo-600">完形填空</span> · 20 题 · 每题 0.5 分
        <span className="ml-2 text-slate-400">点击文中空位答题；{mode === 'practice' ? '练习模式下作答后立即判分并显示解析' : '模考模式下不即时判分'}</span>
      </div>
      <div className="card px-5 py-4 sm:px-6">
        <InteractiveText
          paperId={paperId}
          section="cloze"
          paragraphs={paper.cloze.paragraphs}
          focusAnnotationId={focusAnnotationId}
          blankRenderer={(n) => {
            const rec = byQ.get(n)
            const q = paper.cloze.questions.find((x) => x.n === n)!
            const chosen = rec ? q.options[rec.choice] : null
            let cls = 'blank-slot'
            if (rec && mode === 'practice') cls += rec.correct ? ' correct' : ' wrong'
            else if (rec) cls += ' answered'
            if (activeQ === n) cls += ' active'
            return (
              <span className={cls} onClick={(e) => { e.stopPropagation(); setActiveQ(n) }}>
                {chosen || `〔${n}〕`}
              </span>
            )
          }}
        />
      </div>
    </div>
  )
}
