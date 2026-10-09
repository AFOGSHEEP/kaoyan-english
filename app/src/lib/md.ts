// 极简 markdown → HTML（支持加粗/斜体/标题/引用/列表/换行）；输入为本地静态内容，先转义再转换
export function mdToHtml(md: string): string {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = esc.split(/\n/)
  const out: string[] = []
  let inList = false
  for (let raw of lines) {
    const line = raw.trimEnd()
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul class="ml-4 list-disc">'); inList = true }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
      continue
    }
    if (inList) { out.push('</ul>'); inList = false }
    if (!line.trim()) { out.push(''); continue }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) { out.push(`<div class="mt-2 mb-1 font-semibold">${inline(h[2])}</div>`); continue }
    if (/^&gt;\s?/.test(line)) { out.push(`<div class="border-l-2 border-blue-300 pl-2 my-1 text-slate-600">${inline(line.replace(/^&gt;\s?/, ''))}</div>`); continue }
    if (/^\|/.test(line)) { out.push(`<div class="text-slate-600 text-sm">${inline(line)}</div>`); continue }
    out.push(`<p class="my-1">${inline(line)}</p>`)
  }
  if (inList) out.push('</ul>')
  return out.join('\n')
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 rounded text-[0.9em]">$1</code>')
}
