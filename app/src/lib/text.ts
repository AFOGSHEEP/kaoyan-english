// 文本切分与词元工具：句子 id 锚定、token 化、生词判定

export interface Token {
  text: string
  isWord: boolean
  lower: string // 原词小写
  lemma: string // 还原形式（词干）
}

const WORD_RE = /[A-Za-z][A-Za-z'’-]*/

export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const re = /[A-Za-z][A-Za-z'’-]*|[^A-Za-z]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const t = m[0]
    const isWord = /^[A-Za-z]/.test(t)
    const lower = isWord ? t.toLowerCase() : t
    tokens.push({ text: t, isWord, lower, lemma: isWord ? lemmatize(lower) : t })
  }
  return tokens
}

// 常见不规则变形
const IRREG: Record<string, string> = {
  went: 'go', gone: 'go', was: 'be', were: 'be', been: 'be', is: 'be', are: 'be', am: 'be',
  men: 'man', women: 'woman', children: 'child', mice: 'mouse', feet: 'foot', teeth: 'tooth',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad', said: 'say', says: 'say',
  made: 'make', making: 'make', took: 'take', taking: 'take', given: 'give', giving: 'give',
  found: 'find', told: 'tell', held: 'hold', kept: 'keep', felt: 'feel',
  grew: 'grow', growth: 'grow', knew: 'know', known: 'know', brought: 'bring', thought: 'think',
  ran: 'run', running: 'run', came: 'come', comes: 'come', coming: 'come', became: 'become', becomes: 'become',
  got: 'get', gets: 'get', getting: 'get', began: 'begin', begun: 'begin', spoke: 'speak', spoken: 'speak',
  wrote: 'write', written: 'write', broke: 'break', broken: 'break', chose: 'choose', chosen: 'choose',
  drove: 'drive', driven: 'drive', drew: 'draw', drawn: 'draw', fell: 'fall', fallen: 'fall',
  rose: 'rise', risen: 'rise', raised: 'raise', lost: 'lose', losing: 'lose', paid: 'pay',
  sold: 'sell', sent: 'send', spent: 'spend', built: 'build', sat: 'sit', stood: 'stand', understood: 'understand'
}

// 简易词形还原：复数/时态/ing（保守规则，宁可不还原）
export function lemmatize(w: string): string {
  if (IRREG[w]) return IRREG[w]
  if (w.length <= 3) return w
  const rules: [RegExp, string][] = [
    [/ies$/, 'y'], [/ves$/, 'f'], [/([sxz]|ch|sh)es$/, '$1'], [/s$/, ''],
    [/ying$/, 'y'], [/(.)\1ing$/, '$1'], [/ing$/, ''], [/ied$/, 'y'], [/(.)\1ed$/, '$1'], [/ed$/, ''],
    [/ier$/, 'y'], [/iest$/, 'y']
  ]
  for (const [re, rep] of rules) {
    if (re.test(w)) {
      const cand = w.replace(re, rep)
      if (cand.length >= 3) return cand
    }
  }
  return w
}

// 句子切分（保留结尾标点；处理 Mr./Dr./e.g. 等常见缩写）
const ABBR = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|Fig|No|pp|ed|al)\.$/

export interface Sentence { id: string; text: string }

// 单段 → 句子文本数组（句 id 由调用方按 `${prefix}:p${pi}:s${si}` 拼接，保证批注锚稳定）
export function splitPara(para: string): string[] {
  const rough = para.split(/(?<=[.!?]["”’)]?)\s+(?=[A-Z“"(])/)
  const out: string[] = []
  let buf = ''
  for (const s of rough) {
    buf = buf ? buf + ' ' + s : s
    if (ABBR.test(buf.trim())) continue
    out.push(buf.trim())
    buf = ''
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

export function splitSentences(prefix: string, paragraphs: string[]): Sentence[] {
  const out: Sentence[] = []
  paragraphs.forEach((para, pi) => {
    splitPara(para).forEach((text, si) => out.push({ id: `${prefix}:p${pi}:s${si}`, text }))
  })
  return out
}

// ---------- SRS（固定间隔阶梯） ----------
const SRS_STEPS = [1, 2, 4, 7, 15, 30, 60] // 天

export function srsGrade(srs: { due: number; interval: number; reps: number; lapses: number }, grade: 'again' | 'hard' | 'good') {
  const day = 86400_000
  if (grade === 'again') {
    return { due: Date.now() + 10 * 60_000, interval: 0, reps: srs.reps + 1, lapses: srs.lapses + 1 }
  }
  let interval: number
  if (grade === 'hard') {
    interval = Math.max(1, Math.round((srs.interval || 1) * 0.6))
  } else {
    const idx = Math.min(srs.reps, SRS_STEPS.length - 1)
    interval = srs.reps === 0 ? SRS_STEPS[0] : Math.min(120, Math.round(Math.max(srs.interval * 2.2, SRS_STEPS[idx])))
  }
  return { due: Date.now() + interval * day, interval, reps: srs.reps + 1, lapses: srs.lapses }
}

export function fmtDue(ts: number): string {
  const d = new Date(ts)
  const now = Date.now()
  if (ts <= now) return '待复习'
  const diff = ts - now
  if (diff < 86400_000) return `${Math.ceil(diff / 3600_000)} 小时后`
  return `${Math.ceil(diff / 86400_000)} 天后`
}
