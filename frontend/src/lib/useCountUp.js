import { useEffect, useRef, useState } from 'react'

// Raqamni avvalgi qiymatdan yangisiga silliq "sanab" o'tkazadi (ease-out, ~0.9 s).
// Harakatni kamaytirish yoqilgan bo'lsa, darhol yakuniy qiymat ko'rsatiladi.
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(target ?? 0)
  const from = useRef(0)

  useEffect(() => {
    if (target == null || Number.isNaN(target)) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setValue(target)
      from.current = target
      return
    }
    const start = performance.now()
    const begin = from.current
    let frame = 0
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(begin + (target - begin) * eased))
      if (p < 1) frame = requestAnimationFrame(tick)
      else from.current = target
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}
