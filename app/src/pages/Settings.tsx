import { useRef } from 'react'
import { exportAll, importAll } from '../db'
import { useToast } from '../stores/settings'
import { useSettings } from '../stores/settings'
import { buildDiagnosticsPack } from '../lib/logger'

const download = (data: unknown, name: string) => {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export function Settings() {
  const toast = useToast((s) => s.show)
  const { fontSize, setFontSize, showVocabHints, setShowVocabHints } = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = async () => {
    const data = await exportAll()
    download(data, `kaoyan-backup-${new Date().toISOString().slice(0, 10)}.json`)
    toast('已导出备份文件')
  }

  const doDiagnostics = async () => {
    const pack = await buildDiagnosticsPack()
    download(pack, `kaoyan-诊断包-${new Date().toISOString().slice(0, 10)}.json`)
    toast('诊断包已导出，交给任意 AI 即可分析')
  }

  const doImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text())
      await importAll(data)
      toast('导入完成')
    } catch (e) {
      toast('导入失败：文件格式错误')
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900">设置</h1>

      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-medium text-slate-800">阅读字号</div>
          <div className="mt-2 flex items-center gap-3">
            <button className="h-8 w-8 rounded-lg border border-slate-300" onClick={() => setFontSize(fontSize - 1)}>−</button>
            <span className="w-12 text-center font-semibold">{fontSize}px</span>
            <button className="h-8 w-8 rounded-lg border border-slate-300" onClick={() => setFontSize(fontSize + 1)}>＋</button>
            <span className="text-xs text-slate-400">正文示例：The quick brown fox jumps over the lazy dog.</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={showVocabHints} onChange={(e) => setShowVocabHints(e.target.checked)} className="h-4 w-4" />
            <div>
              <div className="font-medium text-slate-800">生词提示</div>
              <div className="text-xs text-slate-400">在文章中用虚线下划线标出低频词，点击可查看释义并加入单词本</div>
            </div>
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-medium text-slate-800">数据备份</div>
          <div className="mt-1 text-xs text-slate-400">包含做题记录、单词本、批注。跨设备迁移请导出后在新设备导入。</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={doExport}>导出备份</button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>导入备份</button>
            <input ref={fileRef} type="file" accept=".json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f) }} />
          </div>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="font-medium text-slate-800">🤖 AI 诊断数据包</div>
          <div className="mt-1 text-xs leading-relaxed text-slate-500">
            一键导出学习数据摘要（分题型正确率、错题清单、每日趋势、单词本与复习状态、批注、行为日志）。
            把导出的 JSON 发给任意 AI 助手（Claude / ChatGPT / GLM…），它就能诊断你的薄弱项并给出补强计划。
          </div>
          <button className="mt-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110 active:scale-95" onClick={doDiagnostics}>
            导出 AI 诊断数据包
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          <div className="font-medium text-slate-800">关于</div>
          <p className="mt-2 leading-relaxed">
            考研英语（一）真题题库 · 2005–2025 共 21 套。数据来自开源真题仓库并经多源答案交叉校验；
            解析基于开源解析校订增强。个人学习用途。添加到主屏幕（iOS：Safari 分享 → 添加到主屏幕；安卓：浏览器菜单 → 安装应用）即可全屏离线使用。
          </p>
        </div>
      </div>
    </div>
  )
}
