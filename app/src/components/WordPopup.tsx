import { useEffect, useState } from 'react'
import { lookup } from '../lib/wordActions'
import { addWord } from '../lib/wordActions'
import { useToast } from '../stores/settings'

interface Props {
  word: string
  glossOverride?: { ph?: string; pos?: string; g: string } | null
  x: number
  y: number
  sentenceContext?: string
  source?: { paperId?: string; section?: string }
  onClose: () => void
}

export function WordPopup({ word, glossOverride, x, y, sentenceContext, source, onClose }: Props) {
  const [gloss, setGloss] = useState(glossOverride || null)
  const [loading, setLoading] = useState(!glossOverride)
  const toast = useToast((s) => s.show)

  useEffect(() => {
    if (glossOverride) return
    let alive = true
    lookup(word).then((g) => { if (alive) { setGloss(g); setLoading(false) } })
    return () => { alive = false }
  }, [word, glossOverride])

  const left = Math.min(Math.max(x, 150), window.innerWidth - 150)
  const top = Math.min(Math.max(y, 70), window.innerHeight - 200)

  return (
    <div className="word-popup fixed z-50 w-72 max-w-[90vw] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
      style={{ left, top }}>
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold text-slate-900">{word}</span>
        {gloss?.ph && <span className="text-sm text-slate-400">{gloss.ph}</span>}
      </div>
      <div className="mt-1 min-h-[2rem] text-sm text-slate-700">
        {loading ? <span className="text-slate-400">查询中…</span>
          : gloss ? <span>{gloss.pos && <b className="mr-1 text-slate-500">{gloss.pos}</b>}{gloss.g}</span>
            : <span className="text-slate-400">本地词典暂无释义，可加入单词本后自行补充</span>}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        {sentenceContext && (
          <button className="rounded bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
            onClick={() => addWord(word, { gloss: gloss?.g, phonetic: gloss?.ph, source: { ...source, sentence: sentenceContext } })
              .then((ok) => toast(ok ? `已加入单词本：${word}` : `${word} 已在单词本中`))}>
            ＋带例句加入
          </button>
        )}
        <button className="rounded bg-blue-600 px-3 py-1 text-xs text-white"
          onClick={() => addWord(word, { gloss: gloss?.g, phonetic: gloss?.ph, source })
            .then((ok) => { toast(ok ? `已加入单词本：${word}` : `${word} 已在单词本中`); if (ok) onClose() })}>
          ＋单词本
        </button>
      </div>
    </div>
  )
}
