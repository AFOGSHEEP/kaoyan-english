import { useState } from 'react'

export interface SelectionInfo {
  sid: string
  start: number
  end: number
  text: string
  x: number
  y: number
  mode: 'menu' | 'annotate'
}

interface Props {
  info: SelectionInfo
  onClose: () => void
  onLookup: () => void
  onAddWord: () => void
  onAnnotate: () => void
  onSaveAnnotation: (note: string) => void
}

export function SelectionBubble({ info, onClose, onLookup, onAddWord, onAnnotate, onSaveAnnotation }: Props) {
  const [note, setNote] = useState('')
  const left = Math.min(Math.max(info.x, 140), window.innerWidth - 140)

  if (info.mode === 'menu') {
    return (
      <div className="sel-bubble fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-xl"
        style={{ left, top: Math.max(info.y - 8, 60) }}>
        <button className="rounded-full px-3 py-1 text-sm hover:bg-slate-100" onClick={onLookup}>查词</button>
        <span className="h-4 w-px bg-slate-200" />
        <button className="rounded-full px-3 py-1 text-sm text-blue-700 hover:bg-blue-50" onClick={onAddWord}>＋单词本</button>
        <span className="h-4 w-px bg-slate-200" />
        <button className="rounded-full px-3 py-1 text-sm text-amber-700 hover:bg-amber-50" onClick={onAnnotate}>✎批注</button>
      </div>
    )
  }

  return (
    <div className="sel-bubble fixed z-50 w-72 max-w-[90vw] -translate-x-1/2 rounded-xl border border-amber-200 bg-white p-3 shadow-xl"
      style={{ left, top: Math.max(info.y + 6, 60) }}>
      <div className="mb-1 truncate text-xs text-slate-500">批注对象：{info.text.slice(0, 50)}</div>
      <textarea autoFocus className="h-24 w-full rounded border border-slate-300 p-2 text-sm" placeholder="写下你的理解、联想、语法点…"
        value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-2 flex justify-end gap-2">
        <button className="rounded bg-slate-100 px-3 py-1 text-sm" onClick={onClose}>取消</button>
        <button className="rounded bg-amber-500 px-3 py-1 text-sm text-white disabled:opacity-40" disabled={!note.trim()}
          onClick={() => onSaveAnnotation(note.trim())}>保存批注</button>
      </div>
    </div>
  )
}
