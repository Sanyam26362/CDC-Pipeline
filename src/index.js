import dotenv from 'dotenv'
import logger from './utils/logger.js'
import { testConnection as testPostgres } from './db/postgres.js'
import { testConnection as testRedis } from './db/redis.js'

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

  logger.info('All startup checks passed')
  logger.info('Ready to start CDC pipeline...')
}

startupChecks()