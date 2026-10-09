import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { WordEntry } from '../types'
import { addWord } from '../lib/wordActions'
import { logEvent } from '../lib/logger'
import { useToast } from '../stores/settings'
import { fmtDue } from '../lib/text'
import { Link } from 'react-router-dom'

export function Words() {
  const words = useLiveQuery(() => db.words.orderBy('updatedAt').reverse().toArray(), [])
  const toast = useToast((s) => s.show)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<WordEntry | null>(null)
  const [adding, setAdding] = useState(false)
  const [newWord, setNewWord] = useState('')

  const filtered = useMemo(() => {
    if (!words) return []
    const s = q.trim().toLowerCase()
    return s ? words.filter((w) => w.word.toLowerCase().includes(s) || (w.gloss || '').includes(q)) : words
  }, [words, q])

  const dueCount = words?.filter((w) => w.srs.due <= Date.now()).length || 0

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">单词本</h1>
        <span className="text-sm text-slate-400">{words?.length || 0} 词</span>
        {dueCount > 0 && (
          <Link to="/review" className="ml-auto rounded-full bg-red-500 px-3 py-1 text-sm font-medium text-white">
            {dueCount} 个待复习 →
          </Link>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索单词或释义…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        <button onClick={() => setAdding(true)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">＋手动添加</button>
      </div>

      {adding && (
        <div className="mt-3 flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <input autoFocus value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder="输入单词或短语"
            className="flex-1 rounded-lg border border-blue-300 px-3 py-1.5 text-sm" onKeyDown={async (e) => {
              if (e.key === 'Enter' && newWord.trim()) {
                const ok = await addWord(newWord.trim())
                logEvent({ type: 'word_add', detail: newWord.trim() })
                toast(ok ? '已添加' : '已存在'); setNewWord(''); setAdding(false)
              }
            }} />
          <button className="rounded-lg bg-blue-600 px-3 text-sm text-white" onClick={async () => {
            if (newWord.trim()) { const ok = await addWord(newWord.trim()); toast(ok ? '已添加' : '已存在'); setNewWord(''); setAdding(false) }
          }}>添加</button>
          <button className="rounded-lg px-3 text-sm text-slate-500" onClick={() => setAdding(false)}>取消</button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {filtered.map((w) => (
          <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900">{w.word}</span>
              {w.phonetic && <span className="text-sm text-slate-400">{w.phonetic}</span>}
              {w.srs.due <= Date.now() && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">待复习</span>}
              <span className="ml-auto text-xs text-slate-400">{fmtDue(w.srs.due)}</span>
            </div>
            {w.gloss && <div className="mt-1 text-sm text-slate-700">{w.gloss}</div>}
            {w.notes && <div className="mt-1 text-sm text-amber-800">📝 {w.notes}</div>}
            {w.examples.length > 0 && (
              <div className="mt-1 text-xs italic text-slate-500">{w.examples[0].en.slice(0, 100)}{w.examples[0].en.length > 100 ? '…' : ''}</div>
            )}
            {w.source?.paperId && <div className="mt-1 text-xs text-slate-400">来自 {w.source.paperId.replace('-2',' 英语二')} 年真题</div>}
            <div className="mt-2 flex gap-3 text-xs">
              <button className="text-blue-600 hover:underline" onClick={() => setEditing(w)}>编辑</button>
              <button className="text-red-500 hover:underline" onClick={async () => { await db.words.delete(w.id!); toast('已删除') }}>删除</button>
            </div>
          </div>
        ))}
        {words && !filtered.length && <div className="py-10 text-center text-slate-400">暂无单词。在试卷里选中单词即可加入，或点右上角手动添加。</div>}
      </div>

      {editing && <EditDialog word={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EditDialog({ word, onClose }: { word: WordEntry; onClose: () => void }) {
  const [w, setW] = useState({ ...word })
  const toast = useToast((s) => s.show)
  const save = async () => {
    await db.words.update(word.id!, { ...w, updatedAt: Date.now() })
    toast('已保存'); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-bold text-slate-900">编辑词条</div>
        <Field label="单词"><input className="inp" value={w.word} onChange={(e) => setW({ ...w, word: e.target.value })} /></Field>
        <Field label="音标"><input className="inp" value={w.phonetic || ''} onChange={(e) => setW({ ...w, phonetic: e.target.value })} /></Field>
        <Field label="释义"><textarea className="inp h-16" value={w.gloss || ''} onChange={(e) => setW({ ...w, gloss: e.target.value })} /></Field>
        <Field label="用法 / 备注"><textarea className="inp h-20" value={w.notes || ''} onChange={(e) => setW({ ...w, notes: e.target.value })} placeholder="搭配、辨析、记忆法…" /></Field>
        <Field label="例句（每行一句）"><textarea className="inp h-20" value={w.examples.map((x) => x.en).join('\n')} onChange={(e) => setW({ ...w, examples: e.target.value.split('\n').filter(Boolean).map((en) => ({ en })) })} /></Field>
        <Field label="标签（逗号分隔）"><input className="inp" value={w.tags.join(', ')} onChange={(e) => setW({ ...w, tags: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} /></Field>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg bg-slate-100 px-4 py-2 text-sm" onClick={onClose}>取消</button>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white" onClick={save}>保存</button>
        </div>
        <style>{`.inp{width:100%;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;font-size:14px}`}</style>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mt-3"><div className="text-xs font-semibold text-slate-500">{label}</div>{children}</div>
}
