// Oqim qoidalari: bular TZ'dagi formulalar, boshqa joyda takrorlanmaydi

// Muddatning warnPercent qismi o'tganda sariq, muddat o'tsa qizil
export function levelOf(elapsedMs, slaSeconds, warnPercent) {
  const ratio = elapsedMs / (slaSeconds * 1000)
  if (ratio > 1) return 'late'
  if (ratio >= warnPercent / 100) return 'warn'
  return 'calm'
}

// Navbatdagi o'rin: (kutish / muddat + 0,15) x og'irlik
export function priorityOf(elapsedMs, slaSeconds, weight) {
  return (elapsedMs / (slaSeconds * 1000) + 0.15) * weight
}

// Va'da: eng uzoq taom x koeffitsient + qo'shimcha daqiqa, roundSeconds ga yuqoriga yaxlitlanadi
export function promiseMs(maxPrepMinutes, promise) {
  const raw = maxPrepMinutes * 60 * promise.coefficient + promise.extraMinutes * 60
  return Math.ceil(raw / promise.roundSeconds) * promise.roundSeconds * 1000
}

// So'm 100 ga yaxlitlanadi
export function roundMoney(value) {
  return Math.round(value / 100) * 100
}
