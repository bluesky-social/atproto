export interface EventRunner {
  getCursor(): number | undefined | Promise<number | undefined>
  trackEvent(
    did: string,
    seq: number,
    handler: () => Promise<void>,
  ): Promise<void>
}
