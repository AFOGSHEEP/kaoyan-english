import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Link } from 'react-router-dom'
import { parsePaperId } from '../lib/content'

const sectionLabel = (s: string) => ({
  cloze: '完形填空', 'reading-1': '阅读 Text 1', 'reading-2': '阅读 Text 2', 'reading-3': '阅读 Text 3',
  'reading-4': '阅读 Text 4', partB: '新题型', translation: '翻译'
}[s] || s)

const safeParse = (id?: string) => {
  try { return parsePaperId(id || '') } catch { return { year: 0, examSet: 1 as const } }
}

export function Annotations() {
  const list = useLiveQuery(() => db.annotations.orderBy('updatedAt').reverse().toArray(), [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-black text-slate-900">我的批注</h1>
      <p className="mt-1 text-sm text-slate-400">按更新时间排序 · 点击跳回原文位置</p>
      <div className="mt-4 space-y-2.5">
        {(list || []).map((a) => {
          const { year, examSet } = safeParse(a.paperId)
          const sec = a.section.startsWith('reading')
            ? `reading&text=${a.section.split('-')[1]}`
            : a.section === 'translation' ? 'translation' : a.section
          return (
            <Link key={a.id} to={`/paper/${a.paperId}?sec=${sec}&annot=${a.id}`}
              className="card card-hover block p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="chip bg-slate-100 text-slate-500">{year} · 英语{examSet === 2 ? '二' : '一'} · {sectionLabel(a.section)}</span>
                <span className="ml-auto">{new Date(a.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="mt-1.5 text-sm font-medium leading-relaxed text-slate-800 underline decoration-amber-400 decoration-2 underline-offset-2">
                {a.anchorText.slice(0, 90)}{a.anchorText.length > 90 ? '…' : ''}
              </div>
              <div className="mt-1.5 line-clamp-3 whitespace-pre-wrap rounded-lg bg-amber-50/70 px-2.5 py-1.5 text-sm text-amber-900">{a.note}</div>
            </Link>
          )
        })}
        {list && !list.length && (
          <div className="card py-12 text-center">
            <div className="text-4xl">✎</div>
            <div className="mt-2 text-slate-500">还没有批注</div>
            <div className="mt-1 text-sm text-slate-400">在试卷阅读界面选中任意文字 → ✎批注</div>
          </div>
        )}
      </div>
    </div>
  )
}
