import { Router } from 'express'
import { metrics } from '../../utils/metrics.js'

const router = Router()

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    metrics: metrics.getSummary(),
  })
})

export default router