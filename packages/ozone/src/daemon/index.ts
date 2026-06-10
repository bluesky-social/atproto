import * as prometheus from 'prom-client'
import { OzoneConfig, OzoneSecrets } from '../config/index.js'
import { AppContextOptions } from '../context.js'
import { DaemonContext } from './context.js'

export { EventPusher } from './event-pusher.js'
export { BlobDiverter } from './blob-diverter.js'
export { EventReverser } from './event-reverser.js'
export { ScheduledActionProcessor } from './scheduled-action-processor.js'
export { StrikeExpiryProcessor } from './strike-expiry-processor.js'

export class OzoneDaemon {
  constructor(public ctx: DaemonContext) {}
  static async create(
    cfg: OzoneConfig,
    secrets: OzoneSecrets,
    overrides?: Partial<AppContextOptions>,
    // Optional Prometheus registry for instrumented daemon jobs (e.g. the queue
    // router). Omitted when metrics are not opted in.
    register?: prometheus.Registry,
  ): Promise<OzoneDaemon> {
    const ctx = await DaemonContext.fromConfig(
      cfg,
      secrets,
      overrides,
      register,
    )
    return new OzoneDaemon(ctx)
  }

  async start() {
    await this.ctx.start()
  }

  async processAll() {
    await this.ctx.processAll()
  }

  async destroy() {
    await this.ctx.destroy()
  }
}
