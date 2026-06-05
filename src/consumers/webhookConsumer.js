import axios from 'axios'
import crypto from 'crypto'
import { query } from '../db/postgres.js'
import { BaseConsumer } from './baseConsumer.js'
import { retryWithBackoff } from '../utils/retry.js'
import logger from '../utils/logger.js'
import dotenv from 'dotenv'

dotenv.config()

export class WebhookConsumer extends BaseConsumer {
  constructor() {
    super('WebhookConsumer')
  }

  // Signs payload with HMAC so receivers can verify it's genuine
  signPayload(payload, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')
  }

  async process(event) {
    const { type, table } = event

    try {
      // Find all active subscriptions for this table + operation
      const result = await query(
        `SELECT * FROM webhook_subscriptions
         WHERE table_name = $1
         AND $2 = ANY(events)
         AND active = true`,
        [table, type]
      )

      if (result.rows.length === 0) return

      // Fire all matching webhooks in parallel
      const results = await Promise.allSettled(
        result.rows.map((sub) => this.deliver(event, sub))
      )

      // NEW: Log any webhooks that permanently failed after all retries
      results.forEach((res, index) => {
        if (res.status === 'rejected') {
          logger.error(`[Webhook] Permanent delivery failure to ${result.rows[index].url}`, {
            error: res.reason.message,
            lsn: event.lsn
          })
          // We intentionally do NOT throw here. 
          // One broken client should not stop the rest of the pipeline.
        }
      })

      this.logSuccess(event)
    } catch (err) {
      this.logError(event, err)
      // FIXED: Must throw here! If the DB query fails, the pipeline MUST halt.
      throw err 
    }
  }

  async deliver(event, subscription) {
    const payload = {
      // FIXED: Use deterministic IDs so downstream clients can ignore duplicates
      id: this.getIdempotencyKey(event), 
      table: event.table,
      type: event.type,
      // FIXED: Handle Postgres DELETEs by falling back to event.old
      data: event.row || event.old, 
      timestamp: event.timestamp,
    }

    // Safety check: ensure secret exists before attempting to sign
    const signature = subscription.secret 
      ? this.signPayload(payload, subscription.secret)
      : 'unsigned'

    // Use our custom retry utility to handle network blips
    await retryWithBackoff(
      async () => {
        await axios.post(subscription.url, payload, {
          timeout: parseInt(process.env.WEBHOOK_TIMEOUT_MS) || 5000,
          headers: {
            'Content-Type': 'application/json',
            'X-CDC-Signature': `sha256=${signature}`,
            'X-CDC-Event': event.type,
          },
        })
        logger.debug(`[Webhook] Delivered to ${subscription.url}`, {
          table: event.table,
          type: event.type,
        })
      },
      {
        maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES) || 3,
        baseDelayMs: 1000,
        label: `Webhook delivery to ${subscription.url}`,
        // NEW: Do not retry 4xx errors (Client errors like 404 or 401)
        shouldRetry: (err) => {
          if (err.response && err.response.status >= 400 && err.response.status < 500) {
            return false; // Fatal error, don't waste time retrying
          }
          return true; // Retry 5xx errors or network timeouts
        }
      }
    )
  }
}