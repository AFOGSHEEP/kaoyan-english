import type { Paper, IndexEntry } from '../types'

const BASE = import.meta.env.BASE_URL || '/'

export async function loadIndex(): Promise<IndexEntry[]> {
  const r = await fetch(`${BASE}content/index.json`)
  if (!r.ok) throw new Error('index.json 加载失败')
  return r.json()
}

const cache = new Map<string, Paper>()

// id 形如 '2023'（英语一）或 '2023-2'（英语二）
export function parsePaperId(id: string): { year: number; examSet: 1 | 2 } {
  const m = id.match(/^(\d{4})(-2)?$/)
  if (!m) throw new Error(`无效试卷 ID: ${id}`)
  return { year: +m[1], examSet: m[2] ? 2 : 1 }
}

export async function loadPaper(id: string): Promise<Paper> {
  if (cache.has(id)) return cache.get(id)!
  const r = await fetch(`${BASE}content/papers/${id}.json`)
  if (!r.ok) throw new Error(`${id} 试卷加载失败`)
  const p: Paper = await r.json()
  cache.set(id, p)
  return p
}

// ---------- 词表基准 ----------
let commonWords: Set<string> | null = null
export async function loadCommonWords(): Promise<Set<string>> {
  if (commonWords) return commonWords
  const r = await fetch(`${BASE}content/vocab/common.json`)
  if (r.ok) {
    const arr: string[] = await r.json()
    commonWords = new Set(arr)
  } else {
    commonWords = new Set()
  }
  return commonWords
}

let glossary: Record<string, { ph?: string; pos?: string; g: string }> | null = null
export async function loadGlossary(): Promise<Record<string, { ph?: string; pos?: string; g: string }>> {
  if (glossary) return glossary
  const r = await fetch(`${BASE}content/vocab/glossary.json`)
  glossary = r.ok ? await r.json() : {}
  return glossary!
}
