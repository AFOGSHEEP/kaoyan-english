// AI 操作接口：window.kaoyanAPI
// 桌面版（Electron）由主进程 HTTP 服务桥接到这里；网页/PWA 版 AI 可通过浏览器直接调用。
import { db, exportAll, importAll } from '../db'
import { buildDiagnosticsPack } from './logger'
import { addWord } from './wordActions'
import { loadPaper } from './content'

export interface PlanItem { text: string; done?: boolean }
export interface Plan { createdAt: number; by?: string; items: PlanItem[] }

async function getPlan(): Promise<Plan | null> {
  const row = await db.kv.get('ai-plan')
  return (row?.value as Plan) || null
}
async function setPlan(items: (string | PlanItem)[], by?: string): Promise<Plan> {
  const plan: Plan = {
    createdAt: Date.now(),
    by,
    items: items.map(i => (typeof i === 'string' ? { text: i } : i))
  }
  await db.kv.put({ key: 'ai-plan', value: plan })
  return plan
}
async function togglePlanItem(idx: number): Promise<Plan | null> {
  const plan = await getPlan()
  if (plan?.items[idx]) {
    plan.items[idx].done = !plan.items[idx].done
    await db.kv.put({ key: 'ai-plan', value: plan })
  }
  return plan
}

async function papers() {
  const answers = await db.answers.toArray()
  const byPaper = new Map<string, { done: number; correct: number }>()
  for (const a of answers) {
    const s = byPaper.get(a.paperId) || { done: 0, correct: 0 }
    s.done++
    if (a.correct) s.correct++
    byPaper.set(a.paperId, s)
  }
  return [...byPaper.entries()].map(([paperId, s]) => ({ paperId, done: s.done, correct: s.correct })).sort((a, b) => a.paperId.localeCompare(b.paperId))
}

async function addWords(items: { word: string; gloss?: string; notes?: string; tags?: string[] }[]) {
  const out: { word: string; added: boolean }[] = []
  for (const it of items) out.push({ word: it.word, added: await addWord(it.word, { gloss: it.gloss, notes: it.notes, tags: it.tags }) })
  return out
}

async function answerHistory(paperId?: string) {
  const rows = paperId ? await db.answers.where('paperId').equals(paperId).toArray() : await db.answers.toArray()
  return rows.sort((a, b) => b.doneAt - a.doneAt)
}

export const kaoyanAPI = {
  version: '1.0',
  ping: () => ({ ok: true, app: 'kaoyan-english', version: '1.0', time: Date.now() }),
  // 学习诊断（与设置页"AI 诊断数据包"同源）
  stats: () => buildDiagnosticsPack(),
  // 试卷进度 / 试卷内容（含答案与解析）
  papers,
  paper: (id: string) => loadPaper(id),
  // 做题记录
  answers: (paperId?: string) => answerHistory(paperId),
  mistakes: async () => (await db.answers.filter(a => a.correct === false).toArray()).sort((a, b) => b.doneAt - a.doneAt),
  // 单词本
  words: () => db.words.orderBy('updatedAt').reverse().toArray(),
  addWords,
  updateWord: async (id: number, patch: { gloss?: string; notes?: string; tags?: string[] }) => {
    await db.words.update(id, { ...patch, updatedAt: Date.now() })
    return db.words.get(id)
  },
  deleteWord: (id: number) => db.words.delete(id),
  // 批注 / 行为日志（只读）
  annotations: () => db.annotations.orderBy('updatedAt').reverse().toArray(),
  logs: (limit = 200) => db.logs.orderBy('at').reverse().limit(limit).toArray(),
  // AI 学习计划
  getPlan, setPlan, togglePlanItem,
  clearPlan: async () => { await db.kv.delete('ai-plan'); return true },
  // 全量备份
  exportAll, importAll
}

declare global { interface Window { kaoyanAPI: typeof kaoyanAPI } }
export function mountKaoyanAPI() {
  ;(window as any).kaoyanAPI = kaoyanAPI
}
