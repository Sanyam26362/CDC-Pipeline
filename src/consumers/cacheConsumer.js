import redis from '../db/redis.js'
import { BaseConsumer } from './baseConsumer.js'
import logger from '../utils/logger.js'

export class CacheConsumer extends BaseConsumer {
  constructor() {
    super('CacheConsumer')
  }

  async process(event) {
    const { type, table, row, old } = event

    try {
      if (type === 'INSERT' || type === 'UPDATE') {
        // Safety check: ensure the row actually has an ID before caching
        if (!row || !row.id) return;

        const key = `${table}:${row.id}`
        // Store the full row as JSON, expire after 1 hour to prevent stale data buildup
        await redis.setex(key, 3600, JSON.stringify(row))
        logger.debug(`[Cache] SET ${key}`)
      }

      if (type === 'DELETE') {
        // FIXED: Extract the ID from the 'old' object, because 'row' is null on DELETE
        if (!old || !old.id) return;

        const key = `${table}:${old.id}`
        await redis.del(key)
        logger.debug(`[Cache] DEL ${key}`)
      }

      this.logSuccess(event)
    } catch (err) {
      this.logError(event, err)
      throw err // Throwing ensures the Router knows this consumer failed!
    }
  }
}