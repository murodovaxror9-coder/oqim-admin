import { useLayoutEffect, useRef } from 'react'

// Telefonda jadval qatorlari kartochkaga aylanadi (index.css: .rtable).
// Har katakka sarlavhadagi ustun nomi data-label sifatida yoziladi.
export function useCardTable() {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const table = ref.current
    if (!table) return
    const labels = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
    for (const row of table.querySelectorAll('tbody tr')) {
      const cells = row.children
      if (cells.length !== labels.length) continue
      for (let i = 0; i < cells.length; i++) {
        if (labels[i] && i > 0) cells[i].dataset.label = labels[i]
      }
    }
  })
  return ref
}
