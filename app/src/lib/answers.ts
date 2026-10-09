import { db } from '../db'
import type { SectionId } from '../types'

export async function saveAnswer(opts: {
  paperId: string; section: SectionId; textNo: number; qn: number; choice: string; correctAnswer: string; mode: 'practice' | 'exam'
}) {
  const { paperId, section, textNo, qn, choice, correctAnswer, mode } = opts
  const correct = choice.toUpperCase() === String(correctAnswer).toUpperCase()
  const existing = await db.answers.where('[paperId+section+textNo+qn]').equals([paperId, section, textNo, qn]).first()
  const rec = { paperId, section, textNo, qn, choice, correct, mode, doneAt: Date.now() }
  if (existing?.id) await db.answers.update(existing.id, rec)
  else await db.answers.add(rec)
}

export async function getAnswerMap(paperId: string, section: SectionId, textNo: number) {
  const rows = await db.answers.where('[paperId+section+textNo+qn]')
    .between([paperId, section, textNo, 0], [paperId, section, textNo, Infinity], true, true).toArray()
  return new Map(rows.map((r) => [r.qn, r]))
}

export async function clearSectionAnswers(paperId: string, section: SectionId, textNo: number) {
  const rows = await db.answers.where('[paperId+section+textNo+qn]')
    .between([paperId, section, textNo, 0], [paperId, section, textNo, Infinity], true, true).toArray()
  await db.answers.bulkDelete(rows.map((r) => r.id!))
}

// 整卷统计
export interface PaperStat {
  total: number; done: number; correct: number
  bySection: Record<string, { total: number; done: number; correct: number }>
}
export async function paperStats(paperId: string): Promise<PaperStat> {
  const rows = await db.answers.where('paperId').equals(paperId).toArray()
  const st: PaperStat = { total: 45, done: 0, correct: 0, bySection: {} }
  for (const r of rows) {
    const s = st.bySection[r.section] || (st.bySection[r.section] = { total: 0, done: 0, correct: 0 })
    s.total++; st.done++
    if (r.correct) { s.correct++; st.correct++ }
  }
  return st
}
