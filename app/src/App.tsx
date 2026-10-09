import { HashRouter, Routes, Route, useLocation, Link, Navigate } from 'react-router-dom'
import { Home } from './pages/Home'
import { PaperView } from './pages/PaperView'
import { Words } from './pages/Words'
import { Review } from './pages/Review'
import { Annotations } from './pages/Annotations'
import { Mistakes } from './pages/Mistakes'
import { Settings } from './pages/Settings'
import { useToast } from './stores/settings'
import { useEffect } from 'react'
import { logSessionOnce } from './lib/logger'

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}

const NAV = [
  { to: '/', label: '试卷', icon: '▤' },
  { to: '/words', label: '单词本', icon: '✦' },
  { to: '/review', label: '复习', icon: '↻' },
  { to: '/annotations', label: '批注', icon: '✎' },
  { to: '/mistakes', label: '错题', icon: '✗' },
  { to: '/settings', label: '设置', icon: '⚙' }
]

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 text-xs font-black text-white shadow-sm">英</span>
      <span className="hidden text-sm font-bold tracking-wide text-slate-900 sm:block">真题题库</span>
    </span>
  )
}

function Shell() {
  const loc = useLocation()
  const inPaper = loc.pathname.startsWith('/paper/')
  const toast = useToast((s) => s.msg)

  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  useEffect(() => { logSessionOnce() }, [])

  return (
    <div className="min-h-[100dvh]">
      {!inPaper && (
        <nav className="sticky top-0 z-30 border-b border-white/60 bg-white/75 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2.5">
            <Link to="/" className="mr-3"><Logo /></Link>
            {NAV.map((n) => {
              const active = loc.pathname === n.to
              return (
                <Link key={n.to} to={n.to}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-all
                    ${active ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}>
                  <span className="text-xs opacity-80">{n.icon}</span>{n.label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/paper/:id" element={<PaperView />} />
        <Route path="/words" element={<Words />} />
        <Route path="/review" element={<Review />} />
        <Route path="/annotations" element={<Annotations />} />
        <Route path="/mistakes" element={<Mistakes />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 anim-in lg:bottom-8">
          <div className="rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  )
}
