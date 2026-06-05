// LSN = Log Sequence Number
// Format: "0/1A2B3C4D" — a hexadecimal position in the WAL log
// Higher LSN = later in the log = more recent change

export class LsnTracker {
  constructor() {
    this.currentLsn = '0/0'
    this.confirmedLsn = '0/0'
    this.pendingCount = 0
  }

  // Update current LSN as we receive events
  updateCurrent(lsn) {
    this.currentLsn = lsn
    this.pendingCount++
  }

  // Mark an LSN as confirmed (all consumers processed it)
  confirm(lsn) {
    this.confirmedLsn = lsn
    if (this.pendingCount > 0) this.pendingCount--
  }

  // Compare two LSN values — returns true if lsnA is ahead of lsnB
  isAhead(lsnA, lsnB) {
    // Convert hex LSN string to BigInt for comparison
    const toNumber = (lsn) => {
      const [high, low] = lsn.split('/')
      return (BigInt('0x' + high) << 32n) + BigInt('0x' + low)
    }
    return toNumber(lsnA) > toNumber(lsnB)
  }

  getState() {
    return {
      currentLsn: this.currentLsn,
      confirmedLsn: this.confirmedLsn,
      pendingCount: this.pendingCount,
    }
  }
}