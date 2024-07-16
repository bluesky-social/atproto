import type { ReplayStore } from './replay-store.js'

export class ReplayStoreMemory implements ReplayStore {
  private lastCleanup = Date.now()
  private nonces = new Map<string, number>()

  /**
   * Returns true if the nonce is unique within the given time frame.
   */
  async unique(
    namespace: string,
    nonce: string,
    timeFrame: number,
  ): Promise<boolean> {
    this.cleanup()
    const key = `${namespace}:${nonce}`

    const now = Date.now()

    const exp = this.nonces.get(key)
    this.nonces.set(key, now + timeFrame)

    return exp == null || exp < now
  }

  private cleanup() {
    const now = Date.now()

    if (this.lastCleanup < now - 60_000) {
      for (const [key, expires] of this.nonces) {
        if (expires < now) this.nonces.delete(key)
      }
      this.lastCleanup = now
    }
  }
}
