import express from 'express'
import { apiKeyAuth } from './middleware/auth.js'
import { errorHandler } from './middleware/errorHandler.js'
// Removed unused healthRoutes import
import auditRoutes from './routes/audit.js'
import replayRoutes from './routes/replay.js'
import { metrics } from '../utils/metrics.js'
import logger from '../utils/logger.js'
import dotenv from 'dotenv'

dotenv.config()

export const createServer = () => {
  const app = express()

  app.use(express.json())

  // Public route — used by load balancers and Kubernetes to check if the app is alive
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use('/audit',  apiKeyAuth, auditRoutes)
  app.use('/replay', apiKeyAuth, replayRoutes)
  
  app.get('/metrics', apiKeyAuth, (req, res) => {
    res.json(metrics.getSummary())
  })

  app.use(errorHandler)

  return app
}

export const startServer = (app) => {
  const PORT = process.env.API_PORT || 3000
  const server = app.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`)
  })
  
  return server
}