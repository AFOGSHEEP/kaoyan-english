import { InteractiveText } from '../components/InteractiveText'
import type { PaperViewProps } from '../pages/PaperView'

export function ReadingView({ paper, paperId, textNo, focusAnnotationId }: PaperViewProps & { textNo: number }) {
  const r = paper.readings.find((x) => x.no === textNo) || paper.readings[0]
  return (
    <div>
      <h2 className="mb-3 flex items-baseline gap-2 text-lg font-black text-slate-900">
        {/^Text\s*\d+/i.test(r.title.trim()) ? r.title.trim() : (
          <>Text {r.no}{r.title && <span className="text-sm font-normal text-slate-500">{r.title}</span>}</>
        )}
        <span className="chip bg-slate-100 text-slate-500">5 题 · 每题 2 分</span>
      </h2>
      <div className="card px-5 py-4 sm:px-6">
        <InteractiveText paperId={paperId} section={`reading-${r.no}`} paragraphs={r.paragraphs} focusAnnotationId={focusAnnotationId} />
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400 lg:hidden">
        选中文字可 查词 / 加单词本 / 批注 · 底部答题栏作答
      </div>
    </div>
  )
}
