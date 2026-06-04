import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { query, testConnection } from './postgres.js'
import logger from '../utils/logger.js'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))

const migrations = [
  '001_audit_log.sql',
  '002_checkpoints.sql',
  '003_webhook_subscriptions.sql',
]

const runMigrations = async () => {
  logger.info('Starting database migrations...')

  // Test connection first
  const connected = await testConnection()
  if (!connected) {
    logger.error('Cannot run migrations — database not reachable')
    process.exit(1)
  }

  for (const file of migrations) {
    const filePath = join(__dirname, 'migrations', file)
    const sql = readFileSync(filePath, 'utf8')

    logger.info(`Running migration: ${file}`)
    try {
      await query(sql)
      logger.info(`Migration complete: ${file}`)
    } catch (err) {
      logger.error(`Migration failed: ${file}`, { error: err.message })
      process.exit(1)
    }
  }

  logger.info('All migrations completed successfully')
  process.exit(0)
}

runMigrations()