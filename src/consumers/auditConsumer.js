import { query } from '../db/postgres.js'
import { BaseConsumer } from './baseConsumer.js'

export class AuditConsumer extends BaseConsumer {
  constructor() {
    super('AuditConsumer')
  }

  async process(event) {
    const { type, table, row, old, lsn, timestamp } = event

    try {
      await query(
        `INSERT INTO audit_log 
          (table_name, operation, old_data, new_data, lsn, changed_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (lsn) DO NOTHING`,
        [
          table,
          type,
          old ? JSON.stringify(old) : null,
          row ? JSON.stringify(row) : null,
          lsn,
          timestamp,
        ]
      )

      this.logSuccess(event)
    } catch (err) {
      this.logError(event, err)
      throw err
    }
  }
}