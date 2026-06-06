import dotenv from 'dotenv'
import logger from './utils/logger.js'
import { testConnection as testPostgres } from './db/postgres.js'
import { testConnection as testRedis } from './db/redis.js'
import { CheckpointManager } from './checkpoint/checkpointManager.js'
import { WalListener } from './listener/walListener.js'
import { EventRouter } from './router/eventRouter.js'
import { createServer, startServer } from './api/server.js'
import { metrics } from './utils/metrics.js'

dotenv.config()

let walListener;
let checkpointManager;
let router;
let apiServer;

const main = async () => {
  logger.info('CDC Pipeline starting...')

  const pgOk = await testPostgres()
  if (!pgOk) { logger.error('Postgres failed'); process.exit(1) }

  const redisOk = await testRedis()
  if (!redisOk) { logger.error('Redis failed'); process.exit(1) }

  logger.info('All connections healthy')

  const app = createServer()
  apiServer = startServer(app)

  checkpointManager = new CheckpointManager()
  const lastLsn = await checkpointManager.loadLastCheckpoint()

  router = new EventRouter()
  walListener = new WalListener()

  // FIXED: Boot up all downstream consumers
  await router.startAll()

  // 4. The Main Event Loop
  walListener.on('change', async (event) => {
    metrics.increment('eventsReceived')
    
    try {
      await router.route(event)
      
      metrics.increment('eventsProcessed')
      checkpointManager.recordEventProcessed()
    } catch (err) {
      logger.error('CRITICAL: Pipeline halted due to consumer failure', {
        error: err.message,
        lsn: event.lsn
      })
      metrics.increment('errors', 'PipelineHalt')
      await gracefulShutdown()
      process.exit(1)
    }
  })

  checkpointManager.startAutoCheckpoint(() => {
    const lsn = walListener.getLastLsn()
    if (lsn !== '0/0') walListener.acknowledge(lsn)
    return lsn
  })

  logger.info('Pipeline ready — listening for changes')
  await walListener.start(lastLsn)
}

const gracefulShutdown = async () => {
  logger.info('Initiating graceful shutdown sequence...')

  if (checkpointManager) {
    checkpointManager.stopAutoCheckpoint()
    const finalLsn = walListener.getLastLsn()
    if (finalLsn !== '0/0') {
      await checkpointManager.saveCheckpoint(finalLsn)
      await walListener.acknowledge(finalLsn)
    }
  }

  // Safely stop all components
  if (walListener) await walListener.stop()
  if (router) await router.stopAll()
  if (apiServer) {
    apiServer.close(() => logger.info('API Server closed cleanly'))
  }

  logger.info('Shutdown complete. Goodbye!')
}

process.on('SIGTERM', async () => { logger.info('SIGTERM received'); await gracefulShutdown(); process.exit(0) })
process.on('SIGINT',  async () => { logger.info('SIGINT received');  await gracefulShutdown(); process.exit(0) })

main().catch(err => {
  logger.error('Fatal application crash', { error: err.message })
  process.exit(1)
})