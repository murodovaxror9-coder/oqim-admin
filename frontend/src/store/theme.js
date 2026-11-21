import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Kunduzgi / tungi rejim. Birinchi kirishda tizim sozlamasiga qaraladi.
const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#08080b' : '#ffffff')
}

export const useTheme = create(
  persist(
    (set, get) => ({
      theme: systemDark() ? 'dark' : 'light',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
    }),
    { name: 'oqim-admin-theme', onRehydrateStorage: () => (state) => state && applyTheme(state.theme) },
  ),
)
