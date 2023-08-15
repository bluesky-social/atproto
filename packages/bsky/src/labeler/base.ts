import { AtUri } from '@atproto/uri'
import { AtpAgent } from '@atproto/api'
import { cidForRecord } from '@atproto/repo'
import { dedupe, getFieldsFromRecord } from './util'
import { labelerLogger as log } from '../logger'
import { PrimaryDatabase } from '../db'
import { IdResolver } from '@atproto/identity'
import { BackgroundQueue } from '../background'
import { IndexerConfig } from '../indexer/config'
import { buildBasicAuth } from '../auth'
import { CID } from 'multiformats/cid'

export abstract class Labeler {
  public backgroundQueue: BackgroundQueue
  public pushAgent?: AtpAgent
  constructor(
    protected ctx: {
      db: PrimaryDatabase
      idResolver: IdResolver
      cfg: IndexerConfig
      backgroundQueue: BackgroundQueue
    },
  ) {
    this.backgroundQueue = ctx.backgroundQueue
    if (ctx.cfg.labelerPushUrl) {
      const url = new URL(ctx.cfg.labelerPushUrl)
      this.pushAgent = new AtpAgent({ service: url.origin })
      this.pushAgent.api.setHeader(
        'authorization',
        buildBasicAuth(url.username, url.password),
      )
    }
  }

  processRecord(uri: AtUri, obj: unknown) {
    this.backgroundQueue.add(() =>
      this.createAndStoreLabels(uri, obj).catch((err) => {
        log.error(
          { err, uri: uri.toString(), record: obj },
          'failed to label record',
        )
      }),
    )
  }

  async createAndStoreLabels(uri: AtUri, obj: unknown): Promise<void> {
    const labels = await this.labelRecord(uri, obj)
    if (labels.length < 1) return
    const cid = await cidForRecord(obj)
    const rows = labels.map((val) => ({
      src: this.ctx.cfg.labelerDid,
      uri: uri.toString(),
      cid: cid.toString(),
      val,
      neg: false,
      cts: new Date().toISOString(),
    }))

    await this.ctx.db.db
      .insertInto('label')
      .values(rows)
      .onConflict((oc) => oc.doNothing())
      .execute()

    if (this.pushAgent) {
      const agent = this.pushAgent
      try {
        await agent.api.app.bsky.unspecced.applyLabels({ labels: rows })
      } catch (err) {
        log.error(
          {
            err,
            uri: uri.toString(),
            labels,
            receiver: agent.service.toString(),
          },
          'failed to push labels',
        )
      }
    }
  }

  async labelRecord(uri: AtUri, obj: unknown): Promise<string[]> {
    const { text, imgs } = getFieldsFromRecord(obj)
    const txtLabels = await this.labelText(text.join(' '))
    const imgLabels = await Promise.all(
      imgs.map((cid) => this.labelImg(uri.host, cid)),
    )
    return dedupe([...txtLabels, ...imgLabels.flat()])
  }

  abstract labelText(text: string): Promise<string[]>
  abstract labelImg(did: string, cid: CID): Promise<string[]>

  async processAll() {
    await this.backgroundQueue.processAll()
  }
}
