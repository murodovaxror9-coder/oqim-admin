import cors from 'cors'
import express from 'express'
import swaggerUi from 'swagger-ui-express'
import { config } from './config.js'
import { errorHandler } from './lib/http.js'
import { apiRouter, buildDocument } from './lib/openapi.js'
import './routes/auth.js'
import './routes/hall.js'
import './routes/exceptions.js'
import './routes/reports.js'
import './routes/menu.js'
import './routes/tables.js'
import './routes/bookings.js'
import './routes/forecast.js'
import './routes/staff.js'
import './routes/settings.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: config.corsOrigin, exposedHeaders: ['Content-Disposition'] }))
  app.use(express.json({ limit: '1mb' }))

  const document = buildDocument({ servers: [{ url: `http://localhost:${config.port}`, description: 'Lokal server' }] })
  app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }))
  app.get('/api/openapi.json', (req, res) => res.json(document))
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: 'Oqim API',
      swaggerOptions: { persistAuthorization: true, docExpansion: 'none', tagsSorter: undefined, displayRequestDuration: true },
      customCss: '.swagger-ui .topbar { background: #0B1A33 } .swagger-ui .topbar .download-url-wrapper { display: none }',
    }),
  )
  app.use('/api', apiRouter)
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Bunday manzil yo\'q' } }))
  app.get('/', (req, res) => res.redirect('/api/docs'))
  app.use(errorHandler)
  return app
}
