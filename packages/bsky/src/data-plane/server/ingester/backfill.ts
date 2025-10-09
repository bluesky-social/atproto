import assert from 'node:assert'
import { Agent } from '@atproto/api'
import { OutputSchema as ListReposOutput } from '../../../lexicon/types/com/atproto/sync/listRepos'
import { dataplaneLogger as logger } from '../../../logger'
import { BackfillEvent } from '../types'
import { IngesterOptions } from './types'
import { cursorFor, streamLengthBackpressure, wait } from './util'

export const CURSOR_DONE = '!ingester-done'

export class BackfillIngester {
  started = false
  ac = new AbortController()
  running: Promise<void> | null = null
  agent: Agent
  constructor(private opts: IngesterOptions) {
    this.agent = new Agent(opts.host)
  }
  run() {
    assert(!this.running, 'ingester must not be started')
    const backpressure = streamLengthBackpressure(this.opts)
    this.running = (async () => {
      let cursor =
        (await this.opts.redis.get(cursorFor(this.opts))) ?? undefined
      while (cursor !== CURSOR_DONE) {
        await backpressure(this.ac.signal)
        if (this.ac.signal.aborted) return
        let result: ListReposOutput
        try {
          const listRepos = await this.agent.com.atproto.sync.listRepos({
            cursor,
            limit: 1000,
          })
          result = listRepos.data
        } catch (err) {
          logger.error({ err }, 'backfill list repos failed')
          await wait(5000, this.ac.signal)
          continue
        }
        if (result.repos.length) {
          await this.opts.redis.addMultiToStream(
            result.repos.map((repo) => ({
              id: '*',
              key: this.opts.stream,
              fields: Object.entries({
                repo: JSON.stringify({
                  did: repo.did,
                  host: this.opts.host,
                  rev: repo.rev,
                  status: repo.status,
                  active: repo.active,
                } satisfies BackfillEvent),
              }),
            })),
          )
        }
        cursor = result.cursor ?? CURSOR_DONE
        await this.opts.redis.set(cursorFor(this.opts), cursor)
      }
      this.running = null
    })()
  }
  async stop() {
    this.ac.abort()
    await this.running
  }
}
