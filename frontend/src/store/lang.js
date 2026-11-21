import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useLang = create(
  persist(
    (set) => ({
      lang: 'uz',
      setLang: (lang) => {
        document.documentElement.lang = lang
        set({ lang })
      },
    }),
    { name: 'oqim-admin-lang' },
  ),
)
