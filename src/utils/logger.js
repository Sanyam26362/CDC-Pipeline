import winston from 'winston'
import dotenv from 'dotenv'

dotenv.config()

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      return `[${timestamp}] ${level}: ${message} ${metaStr}`
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
})

export default logger