import { Router } from 'express'
import { query } from '../../db/postgres.js'
import logger from '../../utils/logger.js'


import { eventRouter } from '../../index.js' 

const router = Router()

router.post('/', async (req, res, next) => {
  try {
    const { from, table } = req.body

    if (!from) {
      return res.status(400).json({ error: '"from" timestamp is required' })
    }

    res.status(202).json({
      message: `Replay job accepted and running in the background.`,
      from,
      table: table || 'all',
    })

    runBackgroundReplay(from, table).catch(err => {
      logger.error('Background replay job crashed', { error: err.message })
    })

  } catch (err) {
    next(err)
  }
})

async function runBackgroundReplay(fromTimestamp, targetTable) {
  logger.info('Starting background replay job...', { from: fromTimestamp, table: targetTable })

  let offset = 0
  const BATCH_SIZE = 1000 
  let hasMore = true
  let totalProcessed = 0

  while (hasMore) {
    let sql = `SELECT * FROM audit_log WHERE changed_at >= $1`
    const params = [fromTimestamp]

    if (targetTable) {
      sql += ` AND table_name = $2`
      params.push(targetTable)
    }

    sql += ` ORDER BY changed_at ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(BATCH_SIZE, offset)

    const result = await query(sql, params)

    if (result.rows.length === 0) {
      hasMore = false
      break
    }

    for (const row of result.rows) {
      const simulatedEvent = {
        type: row.operation,
        table: row.table_name,
        // Parse the JSONB data back into objects
        row: row.new_data ? JSON.parse(row.new_data) : null,
        old: row.old_data ? JSON.parse(row.old_data) : null,
        lsn: row.lsn,
        timestamp: row.changed_at
      }

      await eventRouter.route(simulatedEvent)
    }

    totalProcessed += result.rows.length
    offset += BATCH_SIZE
    
    logger.info(`Replay batch complete`, { processedSoFar: totalProcessed })
  }

  logger.info('Background replay job finished successfully!', { totalProcessed })
}

export default router