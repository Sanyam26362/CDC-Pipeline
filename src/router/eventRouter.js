import { routingRules, operationFilters } from './routingRules.js'
import { CacheConsumer } from '../consumers/cacheConsumer.js'
import { AuditConsumer } from '../consumers/auditConsumer.js'
import { WebhookConsumer } from '../consumers/webhookConsumer.js'
import logger from '../utils/logger.js'

export class EventRouter {
  constructor() {
    this.consumers = {
      cache: new CacheConsumer(),
      audit: new AuditConsumer(),
      webhook: new WebhookConsumer(),
    }

    logger.info('Event Router initialized', {
      consumers: Object.keys(this.consumers),
    })
  }

  async startAll() {
    logger.info('Booting up consumers...')
    const consumersArray = Object.values(this.consumers)
    await Promise.all(consumersArray.map(consumer => consumer.connect()))
    logger.info('All consumers connected successfully.')
  }

  async stopAll() {
    logger.info('Shutting down consumers...')
    const consumersArray = Object.values(this.consumers)
    await Promise.all(consumersArray.map(consumer => consumer.disconnect()))
  }

  async route(event) {
    const { type, table } = event

    const consumerNames = routingRules[table]
    if (!consumerNames || consumerNames.length === 0) {
      return
    }

    const tasks = consumerNames
      .filter((name) => {
        // Check operation filter
        const filters = operationFilters[table]?.[name]
        if (!filters) return true          
        return filters.includes(type)       
      })
      .map((name) => {
        const consumer = this.consumers[name]
        
       
        return consumer.process(event)
      })

   
    if (tasks.length > 0) {
      await Promise.all(tasks)
    }
  }
}