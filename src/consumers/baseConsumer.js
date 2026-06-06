import logger from '../utils/logger.js'

export class BaseConsumer {
  constructor(name) {
    this.name = name
  }

 
  async connect() {
    logger.debug(`[${this.name}] No custom connect logic implemented.`)
  }

  async disconnect() {
    logger.debug(`[${this.name}] No custom disconnect logic implemented.`)
  }

  
  async process(event) {
    throw new Error(`Consumer ${this.name} must implement process()`)
  }


  getIdempotencyKey(event) {
    return `${event.table}_${event.lsn}`
  }

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