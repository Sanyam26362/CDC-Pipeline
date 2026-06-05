import dotenv from 'dotenv'
import logger from './utils/logger.js'
import { testConnection as testPostgres } from './db/postgres.js'
import { testConnection as testRedis } from './db/redis.js'
import { CheckpointManager } from './checkpoint/checkpointManager.js'
import { WalListener } from './listener/walListener.js'

dotenv.config()

const main = async () => {
  logger.info('CDC Pipeline starting...')
  logger.info('Running startup checks...')

  // Check Postgres
  const pgOk = await testPostgres()
  if (!pgOk) {
    logger.error('Postgres check failed — exiting')
    process.exit(1)
  }

  // Check Redis
  const redisOk = await testRedis()
  if (!redisOk) {
    logger.error('Redis check failed — exiting')
    process.exit(1)
  }

  logger.info('All startup checks passed')

  // Load last checkpoint
  const checkpointManager = new CheckpointManager()
  const lastLsn = await checkpointManager.loadLastCheckpoint()
  logger.info('Checkpoint manager ready', { resumingFrom: lastLsn })

  // Start WAL listener
  const walListener = new WalListener()

  walListener.on('change', async (event) => {
    logger.info('EVENT RECEIVED', {
      type: event.type,
      table: event.table,
      row: event.row,
    })

    // Save checkpoint first, then acknowledge to Postgres
    await checkpointManager.saveCheckpoint(event.lsn)
    checkpointManager.recordEventProcessed()
    await walListener.acknowledge(event.lsn)
  })

  // Start auto checkpointing
  checkpointManager.startAutoCheckpoint(() => walListener.getLastLsn())

  // Start listening
  logger.info('Starting WAL Listener...')
  await walListener.start(lastLsn)
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully')
  process.exit(0)
})

main()