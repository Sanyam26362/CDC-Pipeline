import logger from '../utils/logger.js'


export class BaseConsumer {
  constructor(name) {
    this.name = name
  }

  // Every consumer must implement this
  async process(event) {
    throw new Error(`Consumer ${this.name} must implement process()`)
  }

  // Shared logging helpers
  logSuccess(event) {
    logger.info(`[${this.name}] Processed event`, {
      type: event.type,
      table: event.table,
      lsn: event.lsn,
    })
  }

  logError(event, err) {
    logger.error(`[${this.name}] Failed to process event`, {
      type: event.type,
      table: event.table,
      lsn: event.lsn,
      error: err.message,
    })
  }
}