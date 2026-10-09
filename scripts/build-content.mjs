// 内容管线：主源 JSON → 应用 schema；pfoocc 答案比对；cross 源文本 diff；产出 content/papers/*.json + index.json + report.md
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'scripts', 'sources');
const OUT = join(ROOT, 'content', 'papers');

// ---------- 工具 ----------
const clean = (s) => String(s ?? '')
  .replace(/\r/g, '')
  // 悬空引号伪影（如行首孤立 “ ” ）
  .replace(/^[“”"'‘’\s]{1,4}(?=[A-Z“"])/gm, (m, ...a) => /["“”]/.test(m) && m.replace(/\s/g, '').length >= 2 ? '' : m)
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

const normForDiff = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');

function wordDiff(a, b) {
  // 简单词级 diff：返回不同片段（长度<=3 视为小差异）
  const wa = a.split(/\s+/), wb = b.split(/\s+/);
  const diffs = [];
  let i = 0, j = 0;
  while (i < wa.length && j < wb.length) {
    if (wa[i] === wb[j]) { i++; j++; continue; }
    // 向前找重同步点
    let ai = -1, bj = -1;
    outer: for (let k = 1; k < 12; k++) {
      for (let m = 1; m < 12; m++) {
        if (wa[i + k] === wb[j + m] && wa[i + k] !== undefined) { ai = i + k; bj = j + m; break outer; }
      }
    }
    if (ai === -1) { diffs.push({ a: wa.slice(i).join(' '), b: wb.slice(j).join(' ') }); return diffs; }
    diffs.push({ a: wa.slice(i, ai).join(' '), b: wb.slice(j, bj).join(' ') });
    i = ai; j = bj;
  }
  if (i < wa.length || j < wb.length) diffs.push({ a: wa.slice(i).join(' '), b: wb.slice(j).join(' ') });
  return diffs;
}

// ---------- pfoocc 答案解析 ----------
function loadPfooccAnswers(year) {
  const dir = join(SRC, 'answers', String(year));
  if (!existsSync(dir)) return null;
  const out = { cloze: null, reading: [] };
  try {
    const clozeTex = readFileSync(join(dir, 'cloze', 'answer.tex'), 'utf8');
    const m = clozeTex.match(/\[(\d+-\d+:[A-D],(?:[A-D],?)+[^\]]*)\]/);
    if (m) out.cloze = m[1].match(/[A-D]/g) || null;
  } catch {}
  for (let t = 1; t <= 4; t++) {
    try {
      const tex = readFileSync(join(dir, 'read', `read${t}_answer.tex`), 'utf8');
      const m = tex.match(/\[([A-D](?:,[A-D])+)\]/);
      if (m) out.reading.push(...m[1].split(','));
    } catch {}
  }
  if (!out.cloze && out.reading.length === 0) return null;
  return out;
}

// ---------- cross 源（XixiGod7）文本提取 ----------
function loadCrossTexts(year) {
  const f = join(SRC, 'cross', `${year}.json`);
  if (!existsSync(f)) return null;
  try {
    const j = JSON.parse(readFileSync(f, 'utf8'));
    const sec = j.sections || {};
    const texts = { cloze: '', readings: [], newType: '' };
    const flat = (x) => Array.isArray(x) ? x.join('\n') : (typeof x === 'string' ? x : x?.article || x?.passage || x?.text || '');
    if (sec.cloze) texts.cloze = flat(sec.cloze);
    if (sec['reading-a']) {
      const arr = Array.isArray(sec['reading-a']) ? sec['reading-a'] : [sec['reading-a']];
      for (const r of arr) texts.readings.push(flat(r));
    }
    if (sec['new-type']) texts.newType = flat(sec['new-type']);
    return texts;
  } catch { return null; }
}

// ---------- 主源转换 ----------
function convertPaper(year, examSet = 1) {
  const dir = examSet === 2 ? `${year}-2` : readdirSync(SRC + '/main').find(d => d.startsWith(String(year)) && !d.includes('-2'));
  const j = JSON.parse(readFileSync(join(SRC, 'main', dir, `${dir}.json`), 'utf8'));
  const pfo = examSet === 1 ? loadPfooccAnswers(year) : null;
  const cross = examSet === 1 ? loadCrossTexts(year >= 2010 ? year : null) : null;

  const secOf = (pred) => j.sections.find(s => pred(s.title || ''));
  const instrOf = (s) => clean(s?.instructions || '');

  const secI = secOf(t => /Section I|Use of English/i.test(t));
  const secA = secOf(t => /Part A/i.test(t))
  const secB = secOf(t => /Part B/i.test(t));
  const secC = secOf(t => /Part C/i.test(t) || /Translation/i.test(t));

  // ---- 完形 ----
  const clozeG = secI?.groups?.find(g => g.type === 'cloze');
  const cloze = {
    instructions: instrOf(secI) || 'For each numbered blank in the following passage, there are four choices marked A, B, C and D. Choose the best one.',
    paragraphs: (clozeG?.passage || []).map(clean),
    questions: (clozeG?.questions || []).map((q, idx) => ({
      n: q.number,
      options: Object.fromEntries(Object.entries(q.options || {}).map(([k, v]) => [k, clean(v)])),
      answer: String(q.answer).trim(),
      explanation: clean(q.explanation),
      verified: pfo?.cloze ? String(pfo.cloze[idx]).toUpperCase() === String(q.answer).trim().toUpperCase() : undefined
    }))
  };

  // ---- 阅读（英语二 group 无 type：按“有 passage + questions 带 options”识别；排除 partB 类型组）----
  const isReadingGroup = (g) => g.type === 'reading' || (g.passage && g.questions?.[0]?.options && !['matching', 'gap_fill', 'ordering', 'heading_matching'].includes(g.type))
  const readings = (secA?.groups || []).filter(isReadingGroup).map((g, ti) => ({
    no: ti + 1,
    title: clean(g.title || ''),
    paragraphs: (g.passage || []).map(clean),
    questions: (g.questions || []).map((q, idx) => {
      const gi = ti * 5 + idx; // cross: 全局阅读题序
      return {
        n: q.number,
        stem: clean(q.stem),
        options: Object.fromEntries(Object.entries(q.options || {}).map(([k, v]) => [k, clean(v)])),
        answer: String(q.answer).trim(),
        explanation: clean(q.explanation),
        verified: pfo?.reading?.[gi] ? String(pfo.reading[gi]).toUpperCase() === String(q.answer).trim().toUpperCase() : undefined
      };
    })
  }));

  // ---- Part B（按 group type 定位，避免英语二 secA/secB 同 section 时取错）----
  const pbG = (secB?.groups || []).find(g => ['matching', 'gap_fill', 'ordering', 'heading_matching'].includes(g?.type))
    || j.sections.flatMap(s => s.groups || []).find(g => ['matching', 'gap_fill', 'ordering', 'heading_matching'].includes(g?.type));
  let variant = 'gapfill';
  if (pbG?.type === 'ordering') variant = 'ordering';
  else if (pbG?.type === 'heading_matching') variant = 'headings';
  else if (pbG?.type === 'matching') variant = (examSet === 2) ? 'matching' : ((pbG.passage && pbG.passage.length) ? 'gapfill' : 'matching');
  else if (pbG?.type === 'gap_fill') variant = 'gapfill';
  const partB = {
    variant,
    instructions: instrOf(secB),
    paragraphs: (pbG?.passage || []).map(clean),
    options: Object.fromEntries(Object.entries(pbG?.options || {}).map(([k, v]) => [k, clean(v)])),
    order: pbG?.order || undefined,
    questions: (pbG?.questions || []).map(q => ({
      n: q.number,
      stem: clean(q.stem || ''),
      answer: String(q.answer).trim(),
      explanation: clean(q.explanation)
    }))
  };

  // ---- 翻译（英语一：5 句划线 translation_sentences/translation；英语二：整段 translation_full）----
  const trG = (secC?.groups || []).find(g => /translation/.test(g.type))
  let translation
  if (trG?.type === 'translation_full') {
    translation = {
      variant: 'full',
      instructions: instrOf(secC) || 'Translate the following text into Chinese. Write your translation on the ANSWER SHEET. (15 points)',
      paragraphs: (trG.passage || []).map(clean),
      sentences: (trG.questions || []).map(q => ({
        n: q.number,
        text: (trG.passage || []).map(clean).join(' '),
        reference: clean(q.answer),
        explanation: clean(q.explanation)
      }))
    }
  } else {
    translation = {
      variant: 'sentences',
      instructions: instrOf(secC) || 'Read the following text carefully and then translate the underlined segments into Chinese.',
      paragraphs: (trG?.passage || []).map(clean),
      sentences: (trG?.questions || []).map(q => ({
        n: q.number,
        text: clean(q.stem),
        reference: clean(q.answer),
        explanation: clean(q.explanation)
      }))
    }
  }

  return { paper: { year, examSet, cloze, readings, partB, translation }, pfo, cross, raw: j }
}

// ---------- 主流程 ----------
mkdirSync(OUT, { recursive: true });
const report = { papers: [], answerConflicts: [], textDiffs: [] };
const jobs = [];
for (let y = 2005; y <= 2025; y++) jobs.push({ year: y, set: 1 });
for (let y = 2010; y <= 2025; y++) jobs.push({ year: y, set: 2 });

const indexEntries = [];
for (const { year, set } of jobs) {
  const tag = set === 2 ? `${year}（英语二）` : `${year}`
  try {
    const { paper, pfo, cross } = convertPaper(year, set);
    // 答案冲突记录
    const conflicts = [];
    paper.cloze.questions.forEach((q, i) => { if (q.verified === false) conflicts.push({ part: 'cloze', n: q.n, main: q.answer, pfo: pfo.cloze?.[i] }); });
    paper.readings.forEach((r, ti) => r.questions.forEach((q, i) => {
      const gi = ti * 5 + i;
      if (q.verified === false) conflicts.push({ part: 'reading', text: ti + 1, n: q.n, main: q.answer, pfo: pfo?.reading?.[gi] });
    }));
    if (conflicts.length) report.answerConflicts.push({ year, conflicts });

    // 文本 diff（与 cross 源比完形+阅读正文）
    if (cross) {
      const diffs = [];
      const mainCloze = paper.cloze.paragraphs.join(' ').replace(/\{\{\d+\}\}/g, '____');
      if (cross.cloze && normForDiff(cross.cloze).length > 200) {
        const d = wordDiff(mainCloze.replace(/[^\w\s]/g, '').split(/\s+/).join(' '), cross.cloze.replace(/[^\w\s]/g, '').split(/\s+/).join(' '));
        if (d.length) diffs.push({ part: 'cloze', diffs: d.slice(0, 8) });
      }
      paper.readings.forEach((r, i) => {
        const cx = cross.readings[i];
        if (!cx) return;
        const d = wordDiff(r.paragraphs.join(' ').replace(/[^\w\s]/g, '').split(/\s+/).join(' '), cx.replace(/[^\w\s]/g, '').split(/\s+/).join(' '));
        if (d.length) diffs.push({ part: `reading-${i + 1}`, diffs: d.slice(0, 5) });
      });
      if (diffs.length) report.textDiffs.push({ year, diffs });
    }

    writeFileSync(join(OUT, set === 2 ? `${year}-2.json` : `${year}.json`), JSON.stringify(paper));
    indexEntries.push({
      year,
      examSet: set,
      counts: {
        cloze: paper.cloze.questions.length,
        reading: paper.readings.reduce((s, r) => s + r.questions.length, 0),
        partB: paper.partB.questions.length,
        translation: paper.translation.sentences.length
      },
      partBVariant: paper.partB.variant,
      verified: {
        cloze: `${paper.cloze.questions.filter(q => q.verified === true).length}/${paper.cloze.questions.filter(q => q.verified !== undefined).length}`,
        reading: `${paper.readings.flatMap(r => r.questions).filter(q => q.verified === true).length}/${paper.readings.flatMap(r => r.questions).filter(q => q.verified !== undefined).length}`
      }
    });
    console.log(`✓ ${tag} cloze:${paper.cloze.questions.length} read:${indexEntries.at(-1).counts.reading} partB:${paper.partB.questions.length}(${paper.partB.variant}) trans:${paper.translation.sentences.length}(${paper.translation.variant})`);
  } catch (e) {
    console.log(`✗ ${tag}: ${e.message}`);
    report.papers.push({ year: tag, error: e.message });
  }
}

writeFileSync(join(ROOT, 'content', 'index.json'), JSON.stringify(indexEntries, null, 1));

// 报告
let md = `# 内容管线报告\n\n`;
md += `## 答案冲突（主源 vs pfoocc）\n\n`;
if (!report.answerConflicts.length) md += `无冲突。可用年份的完形+阅读答案全部一致。\n`;
for (const { year, conflicts } of report.answerConflicts) {
  md += `### ${year}\n`;
  for (const c of conflicts) md += `- ${c.part}${c.text ? ' Text' + c.text : ''} 第${c.n}题: 主源=${c.main} pfoocc=${c.pfo}\n`;
}
md += `\n## 文本差异（主源 vs cross，词级 diff，供增强时复核）\n\n`;
for (const { year, diffs } of report.textDiffs.slice(0, 30)) {
  md += `### ${year}\n`;
  for (const d of diffs) {
    md += `- **${d.part}**: `;
    for (const x of d.diffs) md += `主源\`${x.a.slice(0, 60)}\` ↔ 校对源\`${x.b.slice(0, 60)}\`；`;
    md += `\n`;
  }
}
writeFileSync(join(ROOT, 'content', 'report.md'), md);
console.log('\nindex + report written to content/');
if (report.answerConflicts.length) console.log('⚠ 答案冲突年:', report.answerConflicts.map(x => x.year + '(' + x.conflicts.length + ')').join(', '));
