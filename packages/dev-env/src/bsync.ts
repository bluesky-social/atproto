import getPort from 'get-port'
import * as bsync from '@atproto/bsync'
import type { BsyncConfig } from './types.js'

export class TestBsync {
  constructor(
    public url: string,
    public port: number,
    public service: bsync.BsyncService,
  ) {}

  static async create(cfg: BsyncConfig): Promise<TestBsync> {
    const port = cfg.port || (await getPort())
    const url = `http://localhost:${port}`

    const config = bsync.envToCfg({
      port,
      apiKeys: cfg.apiKeys ?? ['api-key'],
      dbSchema: 'bsync',
      // Keep the pool small: a bsync runs alongside every test network, so a
      // default-sized pool per network quickly exhausts postgres connections.
      dbPoolSize: cfg.dbPoolSize ?? 5,
      ...cfg,
    })

    const service = await bsync.BsyncService.create(config)
    await service.ctx.db.migrateToLatestOrThrow()
    await service.start()

    return new TestBsync(url, port, service)
  }

  get ctx(): bsync.AppContext {
    return this.service.ctx
  }

  /**
   * Current head (max id) of each operation stream. Used to wait for the bsky
   * bsync subscription to catch up in tests, without waiting for the long-poll
   * timeout.
   */
  async getStreamHeads(): Promise<{
    op?: string
    mute?: string
    notif?: string
  }> {
    const db = this.ctx.db.db
    const max = async (table: 'operation' | 'mute_op' | 'notif_op') => {
      const row = await db
        .selectFrom(table)
        .select((eb) => eb.fn.max('id').as('id'))
        .executeTakeFirst()
      return row?.id != null ? String(row.id) : undefined
    }
    const [op, mute, notif] = await Promise.all([
      max('operation'),
      max('mute_op'),
      max('notif_op'),
    ])
    return { op, mute, notif }
  }

  async close() {
    await this.service.destroy()
  }
}
