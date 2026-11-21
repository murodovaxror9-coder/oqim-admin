import path from 'node:path'

try {
  process.loadEnvFile()
} catch {
  // .env fayli bo'lmasa standart qiymatlar ishlatiladi
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'oqim-dev-secret-ozgartiring',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  dbFile: path.resolve(process.env.DB_FILE ?? './data/oqim.db'),
  // DEMO_MODE=true: har ishga tushganda namunaviy buyurtmalar hozirgi vaqtga qarab qayta yaratiladi
  // va zal "jonli" ishlab turadi (ofitsiantlar, oshxona simulyatsiyasi)
  demoMode: (process.env.DEMO_MODE ?? 'true') === 'true',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()),
  guestBaseUrl: process.env.GUEST_BASE_URL ?? 'https://oqim.uz/t',
}
