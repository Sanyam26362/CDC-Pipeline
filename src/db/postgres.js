import pg from 'pg'
import dotenv from 'dotenv'
import logger from '../utils/logger.js'

dotenv.config()

const { Pool } = pg

// Regular connection pool for normal queries
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                  // maximum 10 connections in pool
  idleTimeoutMillis: 30000, // close idle connections after 30s
  connectionTimeoutMillis: 2000, // fail if can't connect in 2s
})

// Test the connection when this module loads
pool.on('connect', () => {
  logger.info('New client connected to PostgreSQL pool')
})

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message })
  process.exit(-1)
})

// Helper function — use this everywhere instead of pool.query directly
export const query = async (text, params) => {
  const start = Date.now()
  try {
    const result = await pool.query(text, params)
    const duration = Date.now() - start
    logger.debug('Executed query', { 
      query: text, 
      duration: `${duration}ms`, 
      rows: result.rowCount 
    })
    return result
  } catch (err) {
    logger.error('Database query error', { 
      query: text, 
      error: err.message 
    })
    throw err
  }
}

// Helper to get a dedicated client (for transactions)
export const getClient = async () => {
  const client = await pool.connect()
  return client
}

// Test connection function — called on startup
export const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() as current_time')
    logger.info('PostgreSQL connected successfully', { 
      time: result.rows[0].current_time 
    })
    return true
  } catch (err) {
    logger.error('PostgreSQL connection failed', { error: err.message })
    return false
  }
}

export default pool