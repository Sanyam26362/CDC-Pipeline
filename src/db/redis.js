import Redis from 'ioredis'
import dotenv from 'dotenv'
import logger from '../utils/logger.js'

dotenv.config()

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    // Reconnect after increasing delay — max 3 seconds
    const delay = Math.min(times * 500, 3000)
    logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`)
    return delay
  },
  lazyConnect: false,
})

redis.on('connect', () => {
  logger.info('Redis connected successfully')
})

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message })
})

redis.on('close', () => {
  logger.warn('Redis connection closed')
})

// Test connection function
export const testConnection = async () => {
  try {
    const result = await redis.ping()
    logger.info('Redis ping successful', { response: result })
    return true
  } catch (err) {
    logger.error('Redis connection failed', { error: err.message })
    return false
  }
}

export default redis