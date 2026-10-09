import { db } from '../db'
import type { LogEvent } from '../types'

// 轻量事件日志：静默记录，失败不抛错（绝不影响主流程）
export function logEvent(e: Omit<LogEvent, 'id' | 'at'>) {
  try {
    db.logs.add({ ...e, at: Date.now() }).catch(() => {})
  } catch { /* ignore */ }
}

// 会话开始：每次打开应用记一次
let sessionLogged = false
export function logSessionOnce() {
  if (sessionLogged) return
  sessionLogged = true
  logEvent({ type: 'session_start' })
}

// ---------- AI 诊断数据包 ----------
// 汇总做题/单词/批注/日志为一份自解释 JSON，交给任意 AI 即可分析学习状况
export async function buildDiagnosticsPack() {
  const [answers, words, annotations, logs] = await Promise.all([
    db.answers.toArray(),
    db.words.toArray(),
    db.annotations.toArray(),
    db.logs.orderBy('at').reverse().limit(2000).toArray()
  ])

  // 按试卷聚合
  const papers: any[] = []
  const byPaper = new Map<string, typeof answers>()
  for (const a of answers) {
    const arr = byPaper.get(a.paperId) || []
    arr.push(a)
    byPaper.set(a.paperId, arr)
  }
  const SEC_NAMES: Record<string, string> = { cloze: '完形填空(每题0.5分)', reading: '阅读理解(每题2分)', partB: '新题型(每题2分)', translation: '翻译(英语一每句2分/英语二整段15分)' }
  for (const [paperId, rows] of byPaper) {
    const p: any = { paperId, sections: {}, wrong: [] }
    for (const sec of ['cloze', 'reading', 'partB', 'translation'] as const) {
      const rs = rows.filter((r) => r.section === sec)
      if (!rs.length) continue
      const done = rs.length
      const correct = rs.filter((r) => r.correct).length
      p.sections[sec] = {
        name: SEC_NAMES[sec],
        done,
        correct,
        accuracy: sec === 'translation' ? null : (done ? Math.round((correct / done) * 100) + '%' : null)
      }
    }
    for (const r of rows.filter((x) => x.correct === false)) {
      p.wrong.push({ section: r.section, textNo: r.textNo, qn: r.qn, chose: r.choice, mode: r.mode })
    }
    papers.push(p)
  }
  papers.sort((a, b) => a.paperId.localeCompare(b.paperId))

  // 整体与趋势
  const objAnswers = answers.filter((a) => a.section !== 'translation')
  const byDay = new Map<string, { done: number; correct: number }>()
  for (const a of objAnswers) {
    const d = new Date(a.doneAt).toISOString().slice(0, 10)
    const s = byDay.get(d) || { done: 0, correct: 0 }
    s.done++
    if (a.correct) s.correct++
    byDay.set(d, s)
  }
  const trend = [...byDay.entries()].sort().slice(-30).map(([date, s]) => ({ date, done: s.done, correct: s.correct }))

  const now = Date.now()
  const dueWords = words.filter((w) => w.srs.due <= now)

  return {
    meta: {
      app: 'kaoyan-english',
      exportedAt: new Date(now).toISOString(),
      说明: '考研英语真题学习数据包。paperId 形如 "2023"(英语一)/"2023-2"(英语二)。字段含义见各区块。给 AI 的诊断建议：分析分题型正确率与错题集中度、按趋势判断近况、检查单词本中高重复查词与复习拖欠、结合批注理解薄弱知识点，最后给出可执行的补强计划。'
    },
    summary: {
      客观题: {
        总作答: objAnswers.length,
        总正确: objAnswers.filter((a) => a.correct).length,
        总正确率: objAnswers.length ? Math.round((objAnswers.filter((a) => a.correct).length / objAnswers.length) * 100) + '%' : '暂无',
        错题数: objAnswers.filter((a) => a.correct === false).length
      },
      分题型: ['cloze', 'reading', 'partB'].map((sec) => {
        const rs = objAnswers.filter((a) => a.section === sec)
        return {
          section: sec, name: SEC_NAMES[sec], done: rs.length,
          accuracy: rs.length ? Math.round((rs.filter((r) => r.correct).length / rs.length) * 100) + '%' : '暂无'
        }
      }),
      翻译自评: (() => {
        const rs = answers.filter((a) => a.section === 'translation')
        return rs.length ? rs.map((r) => ({ paperId: r.paperId, qn: r.qn, 自评分: r.choice })) : '暂无'
      })(),
      单词本: { 词数: words.length, 待复习: dueWords.length, 已掌握_复习5次以上: words.filter((w) => w.srs.reps >= 5).length },
      批注数: annotations.length,
      近30天每日作答: trend
    },
    papers,
    words: words.map((w) => ({
      word: w.word, gloss: w.gloss || '', notes: w.notes || '',
      来源: w.source?.paperId || '', 复习次数: w.srs.reps, 失误次数: w.srs.lapses,
      待复习: w.srs.due <= now, 例句数: w.examples.length
    })),
    annotations: annotations.map((a) => ({ paperId: a.paperId, section: a.section, anchor: a.anchorText.slice(0, 60), note: a.note, at: a.updatedAt })),
    recent_events: logs.map((l) => ({ at: new Date(l.at).toISOString(), type: l.type, paperId: l.paperId, section: l.section, qn: l.qn, detail: l.detail })).slice(0, 500)
  }
}
