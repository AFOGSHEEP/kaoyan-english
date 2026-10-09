// 下载真题源数据 via api.github.com contents API（raw 被墙，API 恒通）
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const OUT = join(process.cwd(), 'sources');

let TOKEN = '';
try {
  const cred = execSync("printf 'protocol=https\nhost=github.com\n\n' | git credential fill", {encoding:'utf8', shell:'/usr/bin/bash', timeout: 15000});
  TOKEN = (cred.match(/^password=(.+)$/m) || [])[1]?.trim() || '';
} catch {}
if (TOKEN) console.log('token: loaded'); else console.log('token: NONE (anonymous, rate limited)');

const H = TOKEN ? { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' } : { Accept: 'application/vnd.github+json' };

async function ghJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: H });
      if (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0') throw new Error('RATE LIMITED');
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      return await r.json();
    } catch (e) {
      if (i === tries - 1 || e.message === 'RATE LIMITED') throw e;
      await new Promise(s => setTimeout(s, 1500 * (i + 1)));
    }
  }
}

async function ghTree(repo) {
  const info = await ghJson(`https://api.github.com/repos/${repo}`);
  const tree = await ghJson(`https://api.github.com/repos/${repo}/git/trees/${info.default_branch}?recursive=1`);
  if (tree.truncated) console.warn('tree truncated!', repo);
  return tree.tree.filter(t => t.type === 'blob').map(t => t.path);
}

// contents API 单文件 <1MB；下载并解码 base64
async function dlContents(repo, path, dest) {
  if (existsSync(dest)) return 'skip';
  const j = await ghJson(`https://api.github.com/repos/${repo}/contents/${path}`);
  const buf = Buffer.from(j.content, j.encoding === 'base64' ? 'base64' : 'utf8');
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  return 'ok';
}

// --- main source: 英语一 2005-2025 (21 套) + index.json ---
const mainTree = await ghTree('LIziak112/structured-kaoyan-english');
const wanted = [];
for (const p of mainTree) {
  const m = p.match(/^data\/(\d{4})(?:-(1|2))?\/\1(?:-(1|2))?\.json$/);
  if (!m) continue;
  const yr = +m[1], set = m[2] || m[3] || '';
  if (yr >= 2005 && yr <= 2025 && set !== '2') wanted.push(p);
}
if (mainTree.includes('index.json')) wanted.push('index.json');
console.log('main wanted:', wanted.length);

let ok = 0;
for (const p of wanted) {
  try {
    const r = await dlContents('LIziak112/structured-kaoyan-english', p, join(OUT, 'main', p.replace(/^data\//, '')));
    if (r !== 'fail') ok++;
    console.log(r, p);
  } catch (e) { console.log('FAIL', p, e.message); }
}
console.log(`main: ${ok}/${wanted.length}`);

// --- cross source (MIT): 2010-2025 校对 ---
const crossTree = await ghTree('XixiGod7/kaoyan-english');
const crossWanted = crossTree.filter(p => /^public\/data\/20(1\d|2[0-5])\.json$/.test(p));
ok = 0;
for (const p of crossWanted) {
  try {
    const r = await dlContents('XixiGod7/kaoyan-english', p, join(OUT, 'cross', p.replace(/^public\/data\//, '')));
    ok++; console.log(r, p);
  } catch (e) { console.log('FAIL', p, e.message); }
}
console.log(`cross: ${ok}/${crossWanted.length}`);

// cross 仓库里是否有词典/词表
const dictCandidates = crossTree.filter(p => /dict|vocab/i.test(p) && p.endsWith('.json'));
console.log('cross dict candidates:', dictCandidates.join(' | ') || '(none)');

// --- answer source: pfoocc 页眉答案 ---
const ansTree = await ghTree('pfoocc/201_204_kaoyan');
const ansWanted = ansTree.filter(p => /^201\/.+\.tex$/.test(p));
ok = 0;
for (const p of ansWanted) {
  try {
    const r = await dlContents('pfoocc/201_204_kaoyan', p, join(OUT, 'answers', p.replace(/^201\//, '')));
    ok++; console.log(r, p);
  } catch (e) { console.log('FAIL', p, e.message); }
}
console.log(`answers: ${ok}/${ansWanted.length}`);
