import { db } from '../db'
import { loadGlossary, loadCommonWords } from './content'
import { lemmatize } from './text'
import type { WordEntry } from '../types'

let glossaryCache: Record<string, { ph?: string; pos?: string; g: string }> | null = null
export async function lookup(word: string) {
  if (!glossaryCache) glossaryCache = await loadGlossary()
  const w = word.toLowerCase()
  return glossaryCache[w] || glossaryCache[lemmatize(w)] || null
}

export async function addWord(
  word: string,
  extra?: Partial<Pick<WordEntry, 'gloss' | 'notes' | 'phonetic' | 'source' | 'tags'>>
) {
  const clean = word.trim()
  if (!clean) return false
  const exist = await db.words.where('word').equalsIgnoreCase(clean).first()
  if (exist) {
    if (extra?.gloss && !exist.gloss) await db.words.update(exist.id!, { gloss: extra.gloss })
    return false // 已存在
  }
  const g = extra?.gloss || (await lookup(clean))?.g || ''
  const ph = extra?.phonetic || (await lookup(clean))?.ph || ''
  const now = Date.now()
  await db.words.add({
    word: clean,
    gloss: g,
    phonetic: ph,
    notes: extra?.notes || '',
    examples: extra?.source?.sentence ? [{ en: extra.source.sentence }] : [],
    tags: extra?.tags || [],
    source: extra?.source,
    srs: { due: now, interval: 0, reps: 0, lapses: 0 },
    createdAt: now,
    updatedAt: now
  })
  return true
}

// 判断是否显示"生词提示"：非常见词且词典可查
let commonSet: Set<string> | null = null
export async function isUncommon(tokenLower: string): Promise<boolean> {
  if (!commonSet) commonSet = await loadCommonWords()
  if (commonSet.size === 0) return false // 词表未生成时不标
  return !commonSet.has(tokenLower)
}
