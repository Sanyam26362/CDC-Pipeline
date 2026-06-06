import dotenv from 'dotenv'
import logger from './utils/logger.js'
import { testConnection as testPostgres } from './db/postgres.js'
import { testConnection as testRedis } from './db/redis.js'
import { CheckpointManager } from './checkpoint/checkpointManager.js'
import { WalListener } from './listener/walListener.js'
import { EventRouter } from './router/eventRouter.js'

dotenv.config()

let walListener;
let checkpointManager;
let eventRouter;

const main = async () => {
  logger.info('CDC Pipeline starting...')
  logger.info('Running startup checks...')

  const pgOk = await testPostgres()
  if (!pgOk) {
    logger.error('Postgres check failed — exiting')
    process.exit(1)
  }

  const redisOk = await testRedis()
  if (!redisOk) {
    logger.error('Redis check failed — exiting')
    process.exit(1)
  }

  logger.info('All startup checks passed')

  checkpointManager = new CheckpointManager()
  walListener = new WalListener()
  eventRouter = new EventRouter()

  await eventRouter.startAll()

  const lastLsn = await checkpointManager.loadLastCheckpoint()
  logger.info('Checkpoint manager ready', { resumingFrom: lastLsn })

  walListener.on('change', async (event) => {
    try {
      await eventRouter.route(event)

      checkpointManager.recordEventProcessed()

    } catch (err) {
   
      logger.error('CRITICAL: Pipeline halted due to consumer failure', { 
        error: err.message, 
        lsn: event.lsn 
      })
      await gracefulShutdown()
      process.exit(1)
    }
  })

  checkpointManager.startAutoCheckpoint(() => {
    const lsn = walListener.getLastLsn()
    if (lsn !== '0/0') walListener.acknowledge(lsn)
    return lsn
  })

  logger.info('Starting WAL Listener...')
  await walListener.start(lastLsn)
}


const gracefulShutdown = async () => {
  logger.info('Initiating graceful shutdown sequence...')
  
  if (checkpointManager) {
    checkpointManager.stopAutoCheckpoint()
    // Force one final save before dying
    const finalLsn = walListener.getLastLsn()
    if (finalLsn !== '0/0') {
      await checkpointManager.saveCheckpoint(finalLsn)
      await walListener.acknowledge(finalLsn)
    }
  }

  if (walListener) await walListener.stop()
  if (eventRouter) await eventRouter.stopAll()
  
  logger.info('Shutdown complete. Goodbye!')
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received')
  await gracefulShutdown()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received (Ctrl+C)')
  await gracefulShutdown()
  process.exit(0)
})

main().catch(err => {
  logger.error('Fatal application crash', { error: err.message })
  process.exit(1)
})