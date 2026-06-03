import dotenv from 'dotenv'
import logger from './utils/logger.js'

dotenv.config()

logger.info('CDC Pipeline starting...')
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
logger.info(`Port: ${process.env.PORT}`)
logger.info('All systems initializing...')