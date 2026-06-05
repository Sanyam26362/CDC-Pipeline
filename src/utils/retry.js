import logger from './logger.js'

export const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    label = 'operation',
    // NEW: Allow caller to decide if an error is worth retrying. Defaults to retrying everything.
    shouldRetry = (err) => true, 
  } = options

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      // NEW: Bail out immediately if this is an unrecoverable error (e.g., 401 Unauthorized)
      if (!shouldRetry(err)) {
        logger.error(`${label} failed with fatal error, aborting retries`, { error: err.message })
        throw err
      }

      if (attempt === maxRetries) {
        logger.error(`${label} failed after ${maxRetries} attempts`, {
          error: err.message,
        })
        throw err
      }

      // FIXED: Full Jitter. Calculates the max backoff, then picks a random number up to that max.
      const maxBackoff = baseDelayMs * Math.pow(2, attempt - 1)
      const delay = Math.floor(Math.random() * maxBackoff) + 50 // +50ms minimum floor
      
      logger.warn(`${label} attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: err.message,
      })
      await new Promise((res) => setTimeout(res, delay))
    }
  }
}