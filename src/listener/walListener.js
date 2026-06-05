import { LogicalReplicationService, Wal2JsonPlugin } from 'pg-logical-replication'
import { EventEmitter } from 'events'
import { parseWalEvent } from './eventParser.js'
import { getReplicationConfig, SLOT_NAME } from './replicationClient.js'
import logger from '../utils/logger.js'

export class WalListener extends EventEmitter {
  constructor() {
    super()
    this.service = null
    this.plugin = null
    this.isRunning = false
    this.lastLsn = '0/0'
  }

  async start(startLsn = '0/0') {
    logger.info('Starting WAL Listener...', { slot: SLOT_NAME, fromLsn: startLsn })

    // Prevent memory leaks: clean up existing service before restarting
    if (this.service) {
      this.service.removeAllListeners()
      this.service = null
    }

    this.plugin = new Wal2JsonPlugin({
      addTables: ['public.users', 'public.orders', 'public.products'],
      includeTypes: true,
      includeTimestamp: true,
    })

    this.service = new LogicalReplicationService(
      getReplicationConfig(),
      { acknowledge: { auto: false } }
    )

    this.service.on('data', async (lsn, log) => {
      this.lastLsn = lsn

      try {
        if (!log.change || log.change.length === 0) {
          // It's safe to acknowledge empty keep-alive heartbeats immediately
          await this.service.acknowledge(lsn)
          return
        }

        for (const rawChange of log.change) {
          const event = parseWalEvent(rawChange, lsn, log.timestamp || null)

          if (event) {
            logger.debug('WAL event emitted', { type: event.type, table: event.table, lsn: event.lsn })
            
            // Emit the event to downstream business logic.
            // WARNING: downstream must handle this fast, or implement a queue!
            this.emit('change', event)
          }
        }

        // NEW FIX: We DO NOT acknowledge the LSN here anymore. 
        // We leave the log in Postgres until the CheckpointManager explicitly tells us it's safe.
      } catch (err) {
        logger.error('Error processing WAL data', { error: err.message, lsn })
      }
    })

    this.service.on('error', async (err) => {
      logger.error('WAL Listener error', { error: err.message })
      this.isRunning = false
      logger.info('Reconnecting WAL Listener in 3 seconds...')
      
      // We don't await this because we are inside the event handler
      setTimeout(() => this.start(this.lastLsn), 3000)
    })

    try {
      this.isRunning = true
      await this.service.subscribe(this.plugin, SLOT_NAME, startLsn)
    } catch (err) {
      logger.error('WAL Listener subscribe failed', { error: err.message })
      this.isRunning = false
      logger.info('Retrying WAL subscription in 5 seconds...')
      setTimeout(() => this.start(this.lastLsn), 5000)
    }
  }

  // NEW FIX: Expose this so the CheckpointManager can confirm safe LSNs to Postgres
  async acknowledge(lsn) {
    if (this.service && this.isRunning) {
      try {
        await this.service.acknowledge(lsn)
        logger.debug('Acknowledged LSN to Postgres', { lsn })
      } catch (err) {
        logger.error('Failed to acknowledge LSN to Postgres', { lsn, error: err.message })
      }
    }
  }

  async stop() {
    logger.info('Stopping WAL Listener...')
    this.isRunning = false
    if (this.service) {
      this.service.removeAllListeners()
      await this.service.stop()
      this.service = null
      logger.info('WAL Listener stopped')
    }
  }

  getLastLsn() {
    return this.lastLsn
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastLsn: this.lastLsn,
      slotName: SLOT_NAME,
    }
  }
}