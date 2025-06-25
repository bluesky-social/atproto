export interface EventRunner {
  getCursor(): Awaited<number | undefined>
  trackEvent(
    did: string,
    seq: number,
    handler: () => Promise<void>,
  ): Promise<void>
}
