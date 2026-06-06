// Simple in-memory metrics tracker
class Metrics {
  constructor() {
    // Standard flat counters
    this.counters = {
      eventsReceived: 0,
      eventsProcessed: 0,
      errors: 0,
    }
    
    // Dimensional counters (e.g., { 'errors:WebhookConsumer': 5 })
    this.taggedCounters = {}
    
    this.startTime = Date.now()
  }

  // FIXED: Added support for granular tagging
  increment(key, tag = null) {
    if (tag) {
      const tagKey = `${key}:${tag}`
      this.taggedCounters[tagKey] = (this.taggedCounters[tagKey] || 0) + 1
    } else if (this.counters[key] !== undefined) {
      this.counters[key]++
    }
  }

  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000)
  }

  // NEW: Calculates Events Per Second (EPS)
  getThroughput() {
    const uptime = this.getUptime()
    if (uptime === 0) return 0
    // Round to 2 decimal places for clean dashboards
    return Math.round((this.counters.eventsProcessed / uptime) * 100) / 100
  }

  getSummary() {
    return {
      ...this.counters,
      throughputEps: this.getThroughput(),
      uptimeSeconds: this.getUptime(),
      breakdown: this.taggedCounters, // Exposes the tagged metrics
    }
  }
}

export const metrics = new Metrics()