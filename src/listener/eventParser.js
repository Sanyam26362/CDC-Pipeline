import logger from '../utils/logger.js'

export const parseWalEvent = (rawChange, lsn, transactionTimestamp) => {
  try {
    const { kind, schema, table, columnnames, columnvalues, oldkeys } = rawChange

    const buildRow = (names, values) => {
      if (!names || !values) return null
      return names.reduce((obj, col, i) => {
        obj[col] = values[i]
        return obj
      }, {})
    }

    const row = buildRow(columnnames, columnvalues)

    
    let oldRow = null
    if (oldkeys) {
      oldRow = buildRow(oldkeys.keynames, oldkeys.keyvalues)
    }

    const parsed = {
      type: kind.toUpperCase(),        
      table: table,
      schema: schema || 'public',
      row: row,                      
      old: oldRow,                     
      lsn: lsn,
      timestamp: transactionTimestamp || new Date().toISOString(),
    }

    logger.debug('Parsed WAL event', {
      type: parsed.type,
      table: parsed.table,
      lsn: parsed.lsn,
    })

    return parsed
  } catch (err) {
    logger.error('Failed to parse WAL event', {
      error: err.message,
      rawChange,
    })
    return null
  }
}