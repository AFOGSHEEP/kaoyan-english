# CLAUDE.md — AI 助手阅读指南（考研英语真题题库）

> 任何 AI 助手（Claude / ChatGPT / GLM / Gemini…）在帮这位用户分析学习状况或维护本项目前，**请先读完本文件**。

## 一、用诊断数据包分析学习效果（最常用场景）

用户会在 App 内 **设置 → 导出 AI 诊断数据包**，得到一份自解释 JSON。把它直接粘给 AI，配合这样一句话即可：

> "这是我的考研英语学习数据包（字段说明在其 meta.说明 里），请诊断我的薄弱项并给出未来两周的补强计划。"

数据包结构：

| 区块 | 内容 | 诊断价值 |
|---|---|---|
| `summary.分题型` | 完形/阅读/新题型各自正确率 | 找最弱题型 |
| `summary.近30天每日作答` | 每日 done/correct | 判断学习频率与状态趋势 |
| `papers[].wrong` | 每套卷错题清单（题号/所选/正确答案） | 定位反复错的题型与年份 |
| `words[]` | 单词本：词、释义、复习次数、失误次数、待复习、来源 | 高失误+高复习次数=难词；大量待复习=复习拖欠 |
| `annotations[]` | 用户亲手写的批注 | **用户自己的困惑点，最直接的弱点信号** |
| `recent_events[]` | 行为日志（作答/查词/加词/复习/翻译自评） | 判断学习习惯（如：只刷题不看解析、查词不复习） |

**建议的诊断框架**（AI 请按此展开）：
1. 总体：正确率水平对照目标分数（阅读 32+/40、新题型 8+/10、完形 6+/10 为稳健线）
2. 结构性弱点：分题型正确率差值 ≥15% 即为显著短板；结合 `papers[].wrong` 看错题是集中在特定题型还是特定文章类型
3. 词汇：`words` 中 `失误次数≥2` 的词、来源重复的词；`待复习=true` 数量是否积压
4. 行为：`recent_events` 中 `answer` 与 `explain_view` 的比例（看没看解析）、`word_add` 与 `word_review` 的比例（收词不复习是常见问题）
5. 输出：请给出**具体到题目**的补救清单（回访哪些错题）+ 两周计划（每天做什么、做多少）+ 下次导出诊断包的预期指标

## 一·二、AI 操作接口（直接读写应用数据，无需用户手动导出）

应用内置两套同构接口，核心是 `window.kaoyanAPI`（app/src/lib/aiapi.ts）：

### A. 桌面版（Windows/Electron）：本机 HTTP API

应用启动后在 `127.0.0.1:3742`（占用时递增到 3752）开 HTTP 服务。**端口与 token 写在**：
`%APPDATA%\kaoyan-english-one\kaoyan-api.json`（含 port/token/base）。所有请求须带头 `X-Kaoyan-Token`。

```bash
# 发现接口（AI 第一步永远先做这个）
cat "$APPDATA/kaoyan-english-one/kaoyan-api.json"
# → { "port": 3742, "token": "<hex>", "base": "http://127.0.0.1:3742/api" }

B=http://127.0.0.1:3742/api; T=<token>
curl -H "X-Kaoyan-Token: $T" $B/ping            # 连通性
curl -H "X-Kaoyan-Token: $T" $B/stats           # 学习诊断包（同设置页导出）
curl -H "X-Kaoyan-Token: $T" $B/papers          # 试卷进度
curl -H "X-Kaoyan-Token: $T" $B/mistakes        # 错题
curl -H "X-Kaoyan-Token: $T" $B/words           # 单词本
curl -H "X-Kaoyan-Token: $T" $B/answers/2023    # 某卷做题记录（paperId："2023"英一/"2023-2"英二）
curl -H "X-Kaoyan-Token: $T" "$B/logs?limit=100" # 行为日志
curl -H "X-Kaoyan-Token: $T" $B/paper/2023      # 整卷内容（题干/选项/答案/解析）

# 写入
curl -X POST  -H "X-Kaoyan-Token: $T" -d '[{"word":"ubiquitous","gloss":"adj. 无处不在的"}]' $B/words
curl -X PATCH -H "X-Kaoyan-Token: $T" -d '{"notes":"常考：科技类阅读"}' $B/words/12
curl -X DELETE -H "X-Kaoyan-Token: $T" $B/words/12
curl -X POST  -H "X-Kaoyan-Token: $T" \
  -d '{"by":"Claude","items":["Day1: 重做2023完形错题","Day1: 复习8个到期单词"]}' \
  $B/plan        # 注入学习计划 → 应用首页实时显示「AI 学习计划」卡片，用户可勾选完成
curl -X POST -H "X-Kaoyan-Token: $T" --data @backup.json $B/import   # 恢复备份
```

其余端点：`GET /api/plan`、`DELETE /api/plan`、`GET /api/annotations`、`GET /api/export`。404 响应会列出全部端点。

### B. 网页/PWA/Android：window.kaoyanAPI

页面全局挂载 `window.kaoyanAPI`，方法与 HTTP 端点一一对应（stats/papers/paper/answers/mistakes/words/addWords/updateWord/deleteWord/annotations/logs/getPlan/setPlan/clearPlan/exportAll/importAll），全部返回 Promise。有浏览器控制能力的 AI（如 browser-use）可在页面里 `evaluate` 调用。

### AI 助手的标准工作流

1. 读 `kaoyan-api.json` → `GET /api/stats`（诊断）
2. 按上面诊断框架分析
3. `POST /api/plan` 注入补强计划（用户打开应用即可见）
4. 需要时 `POST /api/words` 预置生词表
5. 用户完成后再 `GET /api/stats` 对比前后变化

**安全**：服务只监听 127.0.0.1；token 随机生成且每次启动更换；跨源网页无法携带自定义头（天然防 CSRF）；注入参数全部经 JSON 重序列化。

## 二、项目维护（开发者/AI 协作场景）

### 运行与打包

```bash
cd app
npm install
npm run dev                              # 开发服务器（局域网可访问）
npm run build                            # 网页生产构建 → dist/
npm run electron:build                   # Windows 安装包 → release/*.exe
npm run android:sync && npm run android:apk   # Android APK → android/app/build/outputs/apk/debug/
```

网页版线上地址：GitHub Pages（公网，iPhone/Mac 用 Safari 打开后"添加到主屏幕"）。

### 技术栈与结构

React 18 + TypeScript + Vite + Tailwind v4 + Dexie(IndexedDB) + Zustand + vite-plugin-pwa。
Electron 打 Win 包、Capacitor 打 Android 包（均加载同一份 `dist/`）。

```
app/src/
  types.ts          # 全部数据结构（Paper/AnswerRecord/WordEntry/Annotation/LogEvent）
  db.ts             # Dexie 库（answers/words/annotations/logs/kv 五张表）
  lib/
    answers.ts      # 做题记录读写（paperId 为卷标识："2023"英语一 / "2023-2"英语二）
    logger.ts       # 行为日志埋点 + buildDiagnosticsPack() 诊断包生成 ← 分析学习效果的核心
    text.ts         # 分句/tokenize/lemmatize/SRS 调度
    content.ts      # 内容加载（content/papers/*.json + 词表）
    wordActions.ts  # 查词/加单词本
  components/       # InteractiveText（选词/批注/生词引擎）、QuestionCard、气泡/弹层
  views/            # 完形/阅读/新题型/翻译 四个分区视图
  pages/            # Home/PaperView/Words/Review/Annotations/Mistakes/Settings
scripts/            # 内容管线（fetch→build-content→adjudicate→finalize→enhance→build-vocab）
content/            # 生成的试卷内容与词表（同步到 app/public/content 后生效）
```

### 内容管线（重新生成题目数据）

```bash
cd scripts
node fetch-sources.mjs       # 从 GitHub 拉源数据（走 api.github.com，raw 被墙）
node build-content.mjs       # 37 套（英一 21 + 英二 16）→ content/papers/*.json
node adjudicate-e2.mjs       # 英语二答案内容级对齐校验
node finalize.mjs            # 终局答案修正 + verified 标记（英语一多源验证结论固化于此）
node enhance.mjs             # 翻译采分点结构化 + 每题解析尾部生词块
node build-vocab.mjs         # 词表基准 + 词典 → app/public/content/vocab/
# 然后把 content/ 同步到 app/public/content/ 再构建
```

### 已知的坑（改代码前必读）

- **Git Bash 的 heredoc 会把 `\\` 折叠成 `\`**：写含正则的脚本永远用文件编辑工具，不要用 `cat << 'EOF'`。
- pfoocc 答案键与选项不配套：字母比对无意义，必须做**内容级对齐**（字母→选项文本→对齐到本库排列）。详见 scripts/adjudicate-content.mjs 的注释。
- vite 配置必须是 `vite.config.mts`（ESM），否则 `@tailwindcss/vite` 无法被 require。
- Electron/静态部署下用 HashRouter（App.tsx），勿改回 BrowserRouter。
- db schema 有 version 1→2→3 迁移（year→paperId、logs 表），改动表结构必须 bump version 并写 upgrade。

### 数据许可

题目数据来自开源仓库（LIziak112 允许任意使用；解析 CC BY-NC）；个人学习用途。若要公开传播解析内容需自行重写。
