export interface EventRunner {
  getCursor(): Awaited<number | undefined>
  trackEvent(
    did: string,
    seq: number,
    hanlder: () => Promise<void>,
  ): Promise<void>
}
