import { cborToLexRecord, readCar } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { Subscription } from '@atproto/xrpc-server'
import {
  type Account,
  type Commit,
  type Identity,
  type RepoEvent,
  isAccount,
  isCommit,
  isIdentity,
  isValidRepoEvent,
} from './lexicons'
import {
  Event,
  CommitMeta,
  CommitEvt,
  AccountEvt,
  AccountStatus,
  IdentityEvt,
} from './events'

type Opts = {
  service?: string
  getCursor?: () => Promise<number | undefined>
  setCursor?: (cursor: number) => Promise<void>
  subscriptionReconnectDelay?: number
  filterCollections?: string[]
  excludeIdentity?: boolean
  excludeAccount?: boolean
  excludeCommit?: boolean
}

export class Firehose {
  public sub: Subscription<RepoEvent>
  private abortController: AbortController

  constructor(public opts: Opts) {
    this.abortController = new AbortController()
    this.sub = new Subscription({
      service: opts.service ?? 'https://bsky.network',
      method: 'com.atproto.sync.subscribeRepos',
      signal: this.abortController.signal,
      getParams: async () => {
        if (!opts.getCursor) return undefined
        const cursor = await opts.getCursor()
        return { cursor }
      },
      validate: (value: unknown) => {
        try {
          return isValidRepoEvent(value)
        } catch (err) {
          console.error('repo subscription skipped invalid message', err)
        }
      },
    })
  }

  async *run(): AsyncGenerator<Event> {
    try {
      for await (const evt of this.sub) {
        try {
          if (isCommit(evt) && !this.opts.excludeCommit) {
            const parsed = await parseCommit(evt)
            for (const write of parsed) {
              if (
                !this.opts.filterCollections ||
                this.opts.filterCollections.includes(write.uri.collection)
              ) {
                yield write
              }
            }
          } else if (isAccount(evt) && !this.opts.excludeAccount) {
            const parsed = parseAccount(evt)
            if (parsed) {
              yield parsed
            }
          } else if (isIdentity(evt) && !this.opts.excludeIdentity) {
            yield parseIdentity(evt)
          }
        } catch (err) {
          console.error('repo subscription could not handle message', err)
        }
        if (this.opts.setCursor && typeof evt.seq === 'number') {
          await this.opts.setCursor(evt.seq)
        }
      }
    } catch (err) {
      console.error('repo subscription errored', err)
      setTimeout(() => this.run(), this.opts.subscriptionReconnectDelay ?? 3000)
    }
  }

  destroy() {
    this.abortController.abort()
  }
}

export const parseCommit = async (evt: Commit): Promise<CommitEvt[]> => {
  const car = await readCar(evt.blocks)

  const evts: CommitEvt[] = []

  for (const op of evt.ops) {
    const uri = new AtUri(`at://${evt.repo}/${op.path}`)

    const meta: CommitMeta = {
      seq: evt.seq,
      uri,
      did: uri.host,
      collection: uri.collection,
      rkey: uri.rkey,
    }

    if (op.action === 'create' || op.action === 'update') {
      if (!op.cid) continue
      const recordBytes = car.blocks.get(op.cid)
      if (!recordBytes) continue
      const record = cborToLexRecord(recordBytes)
      evts.push({
        ...meta,
        event: op.action as 'create' | 'update',
        cid: op.cid,
        record,
      })
    }

    if (op.action === 'delete') {
      evts.push({
        ...meta,
        event: 'delete',
      })
    }
  }

  return evts
}

export const parseIdentity = (evt: Identity): IdentityEvt => {
  return {
    event: 'identity',
    seq: evt.seq,
    did: evt.did,
    handle: evt.handle,
  }
}

export const parseAccount = (evt: Account): AccountEvt | undefined => {
  if (evt.status && !isValidStatus(evt.status)) return
  return {
    event: 'account',
    seq: evt.seq,
    did: evt.did,
    active: evt.active,
    status: evt.status as AccountStatus,
  }
}

const isValidStatus = (str: string): str is AccountStatus => {
  return ['takendown', 'suspended', 'deleted', 'deactivated'].includes(str)
}
