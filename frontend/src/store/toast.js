import { create } from 'zustand'

let counter = 0

export const useToasts = create((set) => ({
  items: [],
  push: (message, tone = 'ok') => {
    const id = ++counter
    set((state) => ({ items: [...state.items, { id, message, tone }] }))
    setTimeout(() => set((state) => ({ items: state.items.filter((item) => item.id !== id) })), 4200)
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
}))

export const toast = (message, tone) => useToasts.getState().push(message, tone)
