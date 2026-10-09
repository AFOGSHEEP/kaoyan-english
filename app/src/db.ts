import Dexie, { type EntityTable } from 'dexie'
import type { AnswerRecord, WordEntry, Annotation, LogEvent } from './types'

class AppDB extends Dexie {
  answers!: EntityTable<AnswerRecord, 'id'>
  words!: EntityTable<WordEntry, 'id'>
  annotations!: EntityTable<Annotation, 'id'>
  logs!: EntityTable<LogEvent, 'id'>
  kv!: EntityTable<{ key: string; value: unknown }, 'key'>

  constructor() {
    super('kaoyan-english-one')
    this.version(2).stores({
      answers: '++id, [paperId+section+textNo+qn], paperId, section, doneAt',
      words: '++id, &word, updatedAt, [srs.due]',
      annotations: '++id, paperId, section, sentenceId, updatedAt',
      kv: 'key'
    }).upgrade(async (tx) => {
      // v1 → v2：year(number) 迁移为 paperId(string)，无 paperId 的旧测试记录清除
      await tx.table('answers').filter((a: any) => !a.paperId).delete()
      await tx.table('annotations').filter((a: any) => !a.paperId).delete()
    })
    this.version(3).stores({
      logs: '++id, at, type'
    })
  }
}

export const db = new AppDB()

export const kvGet = async <T>(key: string): Promise<T | undefined> => {
  const row = await db.kv.get(key)
  return row?.value as T
}
export const kvSet = async (key: string, value: unknown) => {
  await db.kv.put({ key, value })
}

// ---------- 导出 / 导入 ----------
export async function exportAll() {
  return {
    version: 1,
    exportedAt: Date.now(),
    answers: await db.answers.toArray(),
    words: await db.words.toArray(),
    annotations: await db.annotations.toArray(),
    kv: await db.kv.toArray()
  }
}

export async function importAll(data: {
  answers?: AnswerRecord[]
  words?: WordEntry[]
  annotations?: Annotation[]
  kv?: { key: string; value: unknown }[]
}) {
  const strip = <T extends { id?: number }>(arr: T[]) => arr.map(({ id, ...rest }) => rest as T)
  if (data.answers) await db.answers.bulkPut(strip(data.answers))
  if (data.words) {
    // word 唯一键：按 word 去重合并
    const existing = await db.words.toArray()
    const byWord = new Map(existing.map(w => [w.word.toLowerCase(), w]))
    for (const w of strip(data.words)) {
      const cur = byWord.get(w.word.toLowerCase())
      if (cur?.id) {
        await db.words.update(cur.id, { ...w, id: cur.id })
      } else {
        await db.words.put(w)
      }
    }
  }
  if (data.annotations) await db.annotations.bulkPut(strip(data.annotations))
  if (data.kv) await db.kv.bulkPut(data.kv)
}
