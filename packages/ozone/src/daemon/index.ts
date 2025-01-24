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
    await this.ctx.start()
  }

  async processAll() {
    await this.ctx.processAll()
  }

  async destroy() {
    await this.ctx.destroy()
  }
}
