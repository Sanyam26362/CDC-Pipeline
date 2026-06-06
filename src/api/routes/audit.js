import { Router } from 'express'
import { query } from '../../db/postgres.js'

const router = Router()

// GET /audit — query audit log with optional filters and pagination
router.get('/', async (req, res, next) => {
  try {
    // NEW: Extract 'page' parameter, defaulting to page 1
    const { table, operation, from, to, limit = 50, page = 1 } = req.query

    let sql = 'SELECT * FROM audit_log WHERE 1=1'
    const params = []
    let i = 1

    // Safely build the dynamic SQL
    if (table)     { sql += ` AND table_name = $${i++}`;   params.push(table) }
    if (operation) { sql += ` AND operation = $${i++}`;    params.push(operation.toUpperCase()) }
    if (from)      { sql += ` AND changed_at >= $${i++}`;  params.push(from) }
    if (to)        { sql += ` AND changed_at <= $${i++}`;  params.push(to) }

    // Parse pagination variables safely
    const parsedLimit = Math.min(parseInt(limit) || 50, 500) // cap at 500
    const parsedPage = Math.max(parseInt(page) || 1, 1)      // prevent page 0 or negative
    const offset = (parsedPage - 1) * parsedLimit

    // NEW: Append LIMIT and OFFSET to the query
    sql += ` ORDER BY changed_at DESC LIMIT $${i++} OFFSET $${i++}`
    params.push(parsedLimit, offset)

    const result = await query(sql, params)

    res.json({
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        count: result.rows.length,
        // Helper for frontend: if we got exactly the limit back, there is likely a next page
        hasMore: result.rows.length === parsedLimit 
      },
      data: result.rows,
    })
  } catch (err) {
    next(err)
  }
})

// GET /audit/tables — list all tables with change counts
router.get('/tables', async (req, res, next) => {
  try {
    // WARNING: This full table scan is fine for v1, but will be slow when the table hits millions of rows!
    const result = await query(
      `SELECT table_name, operation, COUNT(*) as count
       FROM audit_log
       GROUP BY table_name, operation
       ORDER BY table_name, operation`
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

export default router