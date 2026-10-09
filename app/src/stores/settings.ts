import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  fontSize: number
  showVocabHints: boolean
  mode: 'practice' | 'exam'
  setFontSize: (n: number) => void
  setShowVocabHints: (b: boolean) => void
  setMode: (m: 'practice' | 'exam') => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      fontSize: 17,
      showVocabHints: true,
      mode: 'practice',
      setFontSize: (n) => set({ fontSize: Math.min(26, Math.max(13, n)) }),
      setShowVocabHints: (b) => set({ showVocabHints: b }),
      setMode: (m) => set({ mode: m })
    }),
    { name: 'kaoyan-settings' }
  )
)

// 全局 toast
interface ToastState {
  msg: string | null
  show: (m: string) => void
}
export const useToast = create<ToastState>((set) => ({
  msg: null,
  show: (m) => {
    set({ msg: m })
    setTimeout(() => set({ msg: null }), 2200)
  }
}))
