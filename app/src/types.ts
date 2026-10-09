// 内容 schema（与 scripts/build-content.mjs 输出对应）

export interface Options {
  [label: string]: string
}

export interface ClozeQuestion {
  n: number
  options: Options
  answer: string
  explanation: string
  verified?: boolean // 多源答案校验
}

export interface ReadingQuestion {
  n: number
  stem: string
  options: Options
  answer: string
  explanation: string
  verified?: boolean
}

export interface PartBQuestion {
  n: number
  stem: string // 2022/2024 观点匹配有长题干；七选五/排序为空
  answer: string
  explanation: string
}

export interface TranslationSentence {
  n: number
  text: string
  reference: string
  explanation: string
  points?: { frag: string; score: number }[]
}

export interface Paper {
  year: number
  examSet: 1 | 2
  cloze: {
    instructions: string
    paragraphs: string[] // 含 {{n}} 占位符
    questions: ClozeQuestion[]
  }
  readings: {
    no: number
    title: string
    paragraphs: string[]
    questions: ReadingQuestion[]
  }[]
  partB: {
    variant: 'gapfill' | 'ordering' | 'headings' | 'matching'
    instructions: string
    paragraphs: string[] // ordering: 选项即段落；matching: 空
    options: Options
    order?: string[]
    questions: PartBQuestion[]
  }
  translation: {
    variant: 'sentences' | 'full'
    instructions: string
    paragraphs: string[]
    sentences: TranslationSentence[] // full 模式仅 1 条，text 为整段
  }
}

export interface IndexEntry {
  year: number
  examSet: 1 | 2
  counts: { cloze: number; reading: number; partB: number; translation: number }
  partBVariant: string
  verified: { cloze: string; reading: string }
}

// ---------- 用户数据 ----------

export interface AnswerRecord {
  id?: number
  paperId: string // '2023' 英语一 / '2023-2' 英语二
  section: 'cloze' | 'reading' | 'partB' | 'translation'
  textNo?: number // 阅读 Text1-4
  qn: number
  choice: string // 客观题选项；翻译为自评 0-2
  correct?: boolean
  mode: 'practice' | 'exam'
  doneAt: number
}

export interface WordEntry {
  id?: number
  word: string
  phonetic?: string
  gloss?: string // 释义（可编辑）
  notes?: string // 用法/备注
  examples: { en: string; zh?: string }[]
  tags: string[]
  source?: { paperId?: string; section?: string; sentence?: string }
  srs: { due: number; interval: number; reps: number; lapses: number }
  createdAt: number
  updatedAt: number
}

export interface Annotation {
  id?: number
  paperId: string
  section: string // 'cloze' | 'reading-1'..4 | 'partB' | 'translation'
  sentenceId: string // 稳定句 id
  start: number // 词级偏移（以句内 word token 计）
  end: number
  anchorText: string
  note: string
  color: string
  collapsed: boolean
  createdAt: number
  updatedAt: number
}

export type SectionId = 'cloze' | 'reading' | 'partB' | 'translation'

// ---------- 学习行为日志（供 AI 诊断）----------
export interface LogEvent {
  id?: number
  at: number
  type: 'session_start' | 'answer' | 'explain_view' | 'word_lookup' | 'word_add' | 'word_review' | 'trans_self' | 'annot'
  paperId?: string
  section?: string
  qn?: number
  detail?: string // 简短补充（词、正误、评分等）
}
