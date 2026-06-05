import dotenv from 'dotenv'
import logger from './utils/logger.js'
import { testConnection as testPostgres } from './db/postgres.js'
import { testConnection as testRedis } from './db/redis.js'
import { CheckpointManager } from './checkpoint/checkpointManager.js'
dotenv.config()

const startupChecks = async () => {
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
  
  const checkpointManager = new CheckpointManager()
  const lastLsn = await checkpointManager.loadLastCheckpoint()
  logger.info('Checkpoint manager ready', { resumingFrom: lastLsn })
  logger.info('Checkpoint stats', checkpointManager.getStats())



  logger.info('All startup checks passed')
  logger.info('Ready to start CDC pipeline...')
  
}

startupChecks()