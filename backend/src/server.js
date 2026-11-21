import { config } from './config.js'
import { createApp } from './app.js'
import { refreshDemo } from './db/demo.js'
import { seedIfEmpty } from './db/seed.js'
import { protectTasks, startSimulator } from './demo/simulator.js'
import { runEscalation } from './services/escalation.js'

const seeded = seedIfEmpty()
if (seeded) console.log("Boshlang'ich ma'lumotlar yozildi")

if (config.demoMode) {
  const started = Date.now()
  const protect = refreshDemo(started)
  protectTasks(protect)
  console.log(`Demo ma'lumotlar tayyor (${Date.now() - started} ms)`)
}

runEscalation()
const escalation = setInterval(() => {
  try {
    runEscalation()
  } catch (error) {
    console.error('[escalation]', error.message)
  }
}, 5000)
escalation.unref()
if (config.demoMode) startSimulator()

const server = createApp().listen(config.port, () => {
  console.log(`Oqim API: http://localhost:${config.port}/api`)
  console.log(`Swagger:  http://localhost:${config.port}/api/docs`)
})

const stop = () => server.close(() => process.exit(0))
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
