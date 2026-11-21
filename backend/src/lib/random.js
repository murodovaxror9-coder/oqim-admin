// Takrorlanadigan tasodifiy sonlar (mulberry32): bitta seed bir xil natija beradi
function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createRandom(seed = Date.now()) {
  let state = typeof seed === 'number' ? seed >>> 0 : hash(String(seed))

  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (probability) => next() < probability,
    weighted(entries) {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
      let roll = next() * total
      for (const [value, weight] of entries) {
        roll -= weight
        if (roll <= 0) return value
      }
      return entries[entries.length - 1][0]
    },
    // Musbat, o'rtachasi mean bo'lgan tasodifiy kechikish
    around(mean, spread = 0.35) {
      const u = 1 - next()
      const v = next()
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      return Math.max(mean * 0.3, mean * (1 + spread * z))
    },
  }
}
