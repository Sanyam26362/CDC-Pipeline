import redis from '../db/redis.js'
import { query } from '../db/postgres.js'
import { LsnTracker } from './lsnTracker.js'
import logger from '../utils/logger.js'
import dotenv from 'dotenv'

dotenv.config()

const SLOT_NAME = process.env.REPLICATION_SLOT_NAME || 'cdc_pipeline_slot'
const CHECKPOINT_INTERVAL_MS = parseInt(process.env.CHECKPOINT_INTERVAL_MS) || 5000
const REDIS_KEY = `checkpoint:${SLOT_NAME}`

export class CheckpointManager {
  constructor() {
    this.tracker = new LsnTracker()
    this.intervalHandle = null
    this.isRunning = false 
    this.eventsProcessed = 0
  }

  recordEventProcessed() {
    this.eventsProcessed++
  }

  async loadLastCheckpoint() {
    logger.info('Loading last checkpoint...')

    try {
      const cached = await redis.get(REDIS_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        this.tracker.confirmedLsn = data.lsn
        this.tracker.currentLsn = data.lsn
        
        this.eventsProcessed = data.eventsProcessed || 0 
        
        logger.info('Checkpoint loaded from Redis', { lsn: data.lsn, eventsProcessed: this.eventsProcessed })
        return data.lsn
      }
    } catch (err) {
      logger.warn('Could not load checkpoint from Redis, trying Postgres', {
        error: err.message,
      })
    }

    try {
      // Fall back to Postgres
      const result = await query(
        'SELECT last_lsn, events_processed FROM checkpoints WHERE slot_name = $1',
        [SLOT_NAME]
      )

      if (result.rows.length > 0) {
        const { last_lsn, events_processed } = result.rows[0]
        this.tracker.confirmedLsn = last_lsn
        this.tracker.currentLsn = last_lsn
        this.eventsProcessed = parseInt(events_processed)
        logger.info('Checkpoint loaded from Postgres', { lsn: last_lsn, eventsProcessed: this.eventsProcessed })
        return last_lsn
      }
    } catch (err) {
      logger.error('Could not load checkpoint from Postgres', { error: err.message })
    }

    logger.info('No checkpoint found — starting from beginning (LSN 0/0)')
    return '0/0'
  }

  async saveCheckpoint(lsn) {
    this.tracker.confirm(lsn)
    

    const data = {
      lsn,
      eventsProcessed: this.eventsProcessed,
      savedAt: new Date().toISOString(),
    }

    try {
      await redis.set(REDIS_KEY, JSON.stringify(data))
    } catch (err) {
      logger.warn('Failed to save checkpoint to Redis', { error: err.message })
    }

    try {
      await query(
        `INSERT INTO checkpoints (slot_name, last_lsn, events_processed, updated_at)
         VALUES ($3, $1, $2, NOW())
         ON CONFLICT (slot_name) 
         DO UPDATE SET last_lsn = EXCLUDED.last_lsn, events_processed = EXCLUDED.events_processed, updated_at = NOW()`,
        [lsn, this.eventsProcessed, SLOT_NAME]
      )
    } catch (err) {
      logger.warn('Failed to save checkpoint to Postgres', { error: err.message })
    }
  }

  startAutoCheckpoint(getLsnFn) {
    logger.info(`Auto-checkpoint started (every ${CHECKPOINT_INTERVAL_MS}ms)`)
    this.isRunning = true

    const loop = async () => {
      if (!this.isRunning) return

      try {
        const lsn = getLsnFn()
        if (lsn && lsn !== '0/0') {
          await this.saveCheckpoint(lsn)
          logger.debug('Auto-checkpoint saved', { lsn })
        }
      } catch (err) {
        logger.error('Error during auto-checkpoint', { error: err.message })
      } finally {
        if (this.isRunning) {
          this.intervalHandle = setTimeout(loop, CHECKPOINT_INTERVAL_MS)
        }
      }
    }

    this.intervalHandle = setTimeout(loop, CHECKPOINT_INTERVAL_MS)
  }

  stopAutoCheckpoint() {
    this.isRunning = false
    if (this.intervalHandle) {
      clearTimeout(this.intervalHandle)
      this.intervalHandle = null
      logger.info('Auto-checkpoint stopped')
    }
  }

  getStats() {
    return {
      ...this.tracker.getState(),
      eventsProcessed: this.eventsProcessed,
      slotName: SLOT_NAME,
    }
  }
}