import logger from '../../utils/logger.js'

export const errorHandler = (err, req, res, next) => {
  logger.error('API error', { error: err.message, path: req.path })
  res.status(500).json({ error: 'Internal server error', message: err.message })
}