import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Annotation } from '../types'
import { tokenize, splitPara } from '../lib/text'
import { loadCommonWords, loadGlossary } from '../lib/content'
import { useSettings, useToast } from '../stores/settings'
import { addWord, lookup } from '../lib/wordActions'
import { logEvent } from '../lib/logger'
import { SelectionBubble, type SelectionInfo } from './SelectionBubble'
import { WordPopup } from './WordPopup'

interface Props {
  paperId: string
  section: string // 'cloze' | 'reading-1' | 'partB' | 'translation'
  paragraphs: string[]
  highlightSids?: Set<string>
  focusAnnotationId?: number | null
  /** 完形空位渲染（段落含 {{n}} 占位符时使用） */
  blankRenderer?: (n: number) => React.ReactNode
  className?: string
}

interface SentNode { sid: string; text: string }
interface TokenR { text: string; isWord: boolean; ti: number | null; annot?: Annotation; vocabHint: boolean }
type ParaChild = { kind: 'sent'; node: SentNode; toks: TokenR[]; highlighted?: boolean } | { kind: 'blank'; n: number }

export function InteractiveText({
paperId, section, paragraphs, highlightSids, focusAnnotationId, blankRenderer, className = ''
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { showVocabHints } = useSettings()
  const toast = useToast((s) => s.show)
  const [vocabData, setVocabData] = useState<{ common: Set<string>; gloss: Record<string, { ph?: string; pos?: string; g: string }> } | null>(null)
  const [bubble, setBubble] = useState<(SelectionInfo & { mode: 'menu' | 'annotate' }) | null>(null)
  const [wordPopup, setWordPopup] = useState<{ word: string; x: number; y: number; gloss?: { ph?: string; pos?: string; g: string } | null } | null>(null)
  const [expandedAnnot, setExpandedAnnot] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([loadCommonWords(), loadGlossary()]).then(([common, gloss]) => {
      if (alive) setVocabData({ common, gloss })
    })
    return () => { alive = false }
  }, [])

  const annotations = useLiveQuery(
    () => db.annotations.where('paperId').equals(paperId).and((a) => a.section === section).toArray(),
    [paperId, section]
  )

  // ---------- 结构：段落 → [句子 | 空位] 流 ----------
  const structure = useMemo(() => {
    const annsBySid = new Map<string, Annotation[]>()
    for (const a of annotations || []) {
      const arr = annsBySid.get(a.sentenceId) || []
      arr.push(a)
      annsBySid.set(a.sentenceId, arr)
    }
    return paragraphs.map((para, pi) => {
      const segs = para.split(/(\{\{\d+\}\})/)
      const children: ParaChild[] = []
      let si = 0
      for (const seg of segs) {
        const m = seg.match(/^\{\{(\d+)\}\}$/)
        if (m) { children.push({ kind: 'blank', n: +m[1] }); continue }
        if (!seg) continue
        for (const text of splitPara(seg)) {
          const sid = `${paperId}:${section}:p${pi}:s${si++}`
          const anns = annsBySid.get(sid) || []
          const tokens = tokenize(text)
          let wi = 0
          const toks: TokenR[] = []
          for (const t of tokens) {
            if (!t.isWord) { toks.push({ text: t.text, isWord: false, ti: null, vocabHint: false }); continue }
            const idx = wi++
            const annot = anns.find((a) => idx >= a.start && idx < a.end)
            const vh = !!(vocabData && showVocabHints && vocabData.common.size > 0 && t.isWord && t.text.length > 2
              && !vocabData.common.has(t.lower) && !vocabData.common.has(t.lemma) && !annot)
            toks.push({ text: t.text, isWord: true, ti: idx, annot, vocabHint: vh })
          }
          children.push({ kind: 'sent', node: { sid, text }, toks, highlighted: highlightSids?.has(sid) })
        }
      }
      return { pi, children }
    })
  }, [paragraphs, annotations, vocabData, showVocabHints, section, highlightSids])

  const sidTextMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of structure) for (const c of p.children) if (c.kind === 'sent') m.set(c.node.sid, c.node.text)
    return m
  }, [structure])

  // ---------- 选择 ----------
  const bubbleRef = useRef(bubble)
  bubbleRef.current = bubble
  const computeSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      // 批注输入模式下选区塌缩不应关闭气泡（点击按钮会清空选区）
      if (bubbleRef.current?.mode !== 'annotate') setBubble(null)
      return
    }
    const range = sel.getRangeAt(0)
    const root = rootRef.current
    if (!root || !root.contains(range.startContainer)) return
    const text = sel.toString().trim()
    if (!text || text.length > 200) return
    const els = root.querySelectorAll<HTMLElement>('[data-ti]')
    let sid: string | null = null
    let start = Infinity, end = -Infinity
    els.forEach((el) => {
      if (range.intersectsNode(el)) {
        const s = el.dataset.sid!
        if (sid === null) sid = s
        if (s === sid) {
          const ti = +el.dataset.ti!
          start = Math.min(start, ti)
          end = Math.max(end, ti + 1)
        }
      }
    })
    if (sid === null || start === Infinity) return
    const rect = range.getBoundingClientRect()
    setBubble({ sid, start, end, text, x: rect.left + rect.width / 2, y: rect.top, mode: 'menu' })
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handler = () => { clearTimeout(timer); timer = setTimeout(computeSelection, 220) }
    document.addEventListener('selectionchange', handler)
    return () => { document.removeEventListener('selectionchange', handler); clearTimeout(timer) }
  }, [computeSelection])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('.sel-bubble') || t.closest('.word-popup') || t.closest('.annot-pop') || t.closest('.blank-slot')) return
      setBubble(null); setWordPopup(null)
      if (!t.closest('[data-ti]')) setExpandedAnnot(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // 批注跳转定位
  useEffect(() => {
    if (!focusAnnotationId || !annotations) return
    const a = annotations.find((x) => x.id === focusAnnotationId)
    if (!a) return
    setExpandedAnnot(a.id!)
    const el = rootRef.current?.querySelector(`[data-sid="${a.sentenceId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusAnnotationId, annotations])

  // ---------- token 点击 ----------
  const onTokenClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    const el = e.currentTarget
    const annotId = el.dataset.annotId ? +el.dataset.annotId : null
    if (annotId) { setExpandedAnnot(annotId); setWordPopup(null); return }
    const word = el.textContent || ''
    const r = el.getBoundingClientRect()
    setExpandedAnnot(null)
    const gloss = vocabData?.gloss[word.toLowerCase()] || null
    logEvent({ type: 'word_lookup', paperId, section, detail: word })
    setWordPopup({ word, x: r.left + r.width / 2, y: r.bottom + 6, gloss })
  }

  // ---------- 渲染 ----------
  const renderSentence = (sid: string, toks: TokenR[], highlighted: boolean) => {
    const parts: React.ReactNode[] = []
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]
      if (!t.isWord) { parts.push(<span key={i}>{t.text}</span>); continue }
      const cls = [t.annot ? 'annot-mark' : '', t.vocabHint ? 'vocab-hint' : ''].filter(Boolean).join(' ')
      parts.push(
        <span key={i} data-sid={sid} data-ti={t.ti} data-annot-id={t.annot?.id}
          className={cls || undefined} onClick={onTokenClick}>
          {t.text}
        </span>
      )
    }
    return (
      <span key={sid} data-sid={sid} className={highlighted ? 'locate-hl' : undefined}>
        {parts}{' '}
      </span>
    )
  }

  return (
    <div ref={rootRef} className={`reading-text ${className}`}>
      {structure.map(({ pi, children }) => (
        <p key={pi} className="mb-4 text-justify">
          {children.map((c, i) =>
            c.kind === 'blank'
              ? <span key={`b${i}`}>{blankRenderer ? blankRenderer(c.n) : `〔${c.n}〕`}</span>
              : renderSentence(c.node.sid, c.toks, !!c.highlighted)
          )}
        </p>
      ))}

      {bubble && (
        <SelectionBubble
          info={bubble}
          onClose={() => setBubble(null)}
          onLookup={async () => {
            const w = bubble.text.split(/\s+/)[0]
            const g = await lookup(w)
            const x = bubble.x, y = bubble.y
            setBubble(null)
            setWordPopup({ word: bubble.text, x, y: y + 10, gloss: g })
          }}
          onAddWord={async () => {
            const sentence = sidTextMap.get(bubble.sid) || ''
            const ok = await addWord(bubble.text, { source: { paperId, section, sentence } })
            logEvent({ type: 'word_add', paperId, section, detail: bubble.text })
            toast(ok ? `已加入单词本：${bubble.text}` : `${bubble.text} 已在单词本中`)
            setBubble(null)
          }}
          onAnnotate={() => setBubble({ ...bubble, mode: 'annotate' })}
          onSaveAnnotation={async (note) => {
            const now = Date.now()
            await db.annotations.add({
              paperId, section, sentenceId: bubble.sid, start: bubble.start, end: bubble.end,
              anchorText: bubble.text, note, color: '#f59e0b', collapsed: false, createdAt: now, updatedAt: now
            })
            setBubble(null)
            window.getSelection()?.removeAllRanges()
            logEvent({ type: 'annot', paperId, section, detail: bubble.text.slice(0, 30) })
            toast('批注已保存')
          }}
        />
      )}

      {wordPopup && (
        <WordPopup
          word={wordPopup.word}
          glossOverride={wordPopup.gloss}
          x={wordPopup.x}
          y={wordPopup.y}
          sentenceContext={sentenceContaining(structure, wordPopup.word)}
          source={{ paperId, section }}
          onClose={() => setWordPopup(null)}
        />
      )}

      {expandedAnnot != null && annotations && (
        <AnnotationPopover
          annot={annotations.find((a) => a.id === expandedAnnot)!}
          rootRef={rootRef}
          onClose={() => setExpandedAnnot(null)}
        />
      )}
    </div>
  )
}

function sentenceContaining(structure: { children: ParaChild[] }[], word: string): string {
  const first = word.toLowerCase().split(/\s+/)[0]
  if (!first) return ''
  for (const p of structure) for (const c of p.children) {
    if (c.kind === 'sent' && c.node.text.toLowerCase().includes(first)) return c.node.text
  }
  return ''
}

// ---------- 批注展开泡 ----------
function AnnotationPopover({ annot, rootRef, onClose }: { annot: Annotation; rootRef: React.RefObject<HTMLDivElement | null>; onClose: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(annot.note)
  const toast = useToast((s) => s.show)

  useEffect(() => {
    const el = rootRef.current?.querySelector(`[data-annot-id="${annot.id}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      setPos({ x: r.left + r.width / 2, y: r.bottom + 6 })
    } else setPos({ x: window.innerWidth / 2, y: 120 })
  }, [annot.id, rootRef])

  const save = async () => {
    await db.annotations.update(annot.id!, { note: text, updatedAt: Date.now() })
    setEditing(false)
    toast('批注已更新')
  }

  if (!pos) return null
  return (
    <div className="annot-pop fixed z-50 w-72 max-w-[90vw] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-xl"
      style={{ left: Math.min(Math.max(pos.x, 150), window.innerWidth - 150), top: Math.min(pos.y, window.innerHeight - 180) }}>
      <div className="mb-1 text-xs text-amber-700">批注 · {annot.anchorText.slice(0, 40)}</div>
      {editing ? (
        <div>
          <textarea className="h-24 w-full rounded border border-amber-300 bg-white p-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button className="rounded bg-amber-500 px-3 py-1 text-sm text-white" onClick={save}>保存</button>
            <button className="rounded bg-slate-200 px-3 py-1 text-sm" onClick={() => { setEditing(false); setText(annot.note) }}>取消</button>
          </div>
        </div>
      ) : (
        <>
          <div className="whitespace-pre-wrap text-sm text-slate-800">{annot.note}</div>
          <div className="mt-2 flex gap-2 text-xs">
            <button className="rounded border border-amber-300 bg-white px-2 py-1" onClick={() => setEditing(true)}>编辑</button>
            <button className="rounded border border-red-300 bg-white px-2 py-1 text-red-600"
              onClick={async () => { await db.annotations.delete(annot.id!); onClose(); toast('批注已删除') }}>删除</button>
            <button className="ml-auto rounded border border-slate-300 bg-white px-2 py-1" onClick={onClose}>收起</button>
          </div>
        </>
      )}
    </div>
  )
}
