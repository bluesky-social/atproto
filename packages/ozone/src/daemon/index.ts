import { OzoneConfig, OzoneSecrets } from '../config'
import DaemonContext from './context'
import { AppContextOptions } from '../context'

export { EventPusher } from './event-pusher'
export { BlobDiverter } from './blob-diverter'
export { EventReverser } from './event-reverser'

export class OzoneDaemon {
  constructor(public ctx: DaemonContext) {}
  static async create(
    cfg: OzoneConfig,
    secrets: OzoneSecrets,
    overrides?: Partial<AppContextOptions>,
  ): Promise<OzoneDaemon> {
    const ctx = await DaemonContext.fromConfig(cfg, secrets, overrides)
    return new OzoneDaemon(ctx)
  }

  async start() {
    this.ctx.eventPusher.start()
    this.ctx.eventReverser.start()
  }

  async processAll() {
    await this.ctx.eventPusher.processAll()
  }

  async destroy() {
    await this.ctx.eventReverser.destroy()
    await this.ctx.eventPusher.destroy()
    await this.ctx.db.close()
  }
}
