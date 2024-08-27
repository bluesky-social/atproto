import { createDeferrable, Deferrable, wait } from '@atproto/common'
import { IdResolver } from '@atproto/identity'
import {
  cborToLexRecord,
  formatDataKey,
  parseDataKey,
  readCar,
  RepoVerificationError,
  verifyProofs,
} from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { Subscription } from '@atproto/xrpc-server'
import {
  type Account,
  type Commit,
  type Identity,
  type RepoEvent,
  RepoOp,
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
import { SyncQueue } from './queue'
import { CID } from 'multiformats/cid'

export type FirehoseOptions = {
  idResolver: IdResolver
  unauthenticated?: boolean
  service?: string
  syncQueue?: SyncQueue
  getCursor?: () => Promise<number | undefined>
  onError?: (errorType: FirehoseErrorType, err: unknown) => void
  subscriptionReconnectDelay?: number
  filterCollections?: string[]
  excludeIdentity?: boolean
  excludeAccount?: boolean
  excludeCommit?: boolean
}

export class Firehose {
  private sub: Subscription<RepoEvent>
  private abortController: AbortController
  private destoryDefer: Deferrable

  constructor(public opts: FirehoseOptions) {
    this.destoryDefer = createDeferrable()
    this.abortController = new AbortController()
    this.sub = new Subscription({
      service: opts.service ?? 'wss://bsky.network',
      method: 'com.atproto.sync.subscribeRepos',
      signal: this.abortController.signal,
      getParams: async () => {
        if (opts.getCursor) {
          const cursor = await opts.getCursor()
          return { cursor }
        } else if (opts.syncQueue) {
          return { cursor: opts.syncQueue.cursor }
        }
        return undefined
      },
      validate: (value: unknown) => {
        try {
          return isValidRepoEvent(value)
        } catch (err) {
          if (opts.onError) {
            opts.onError('validation', err)
          }
        }
      },
    })
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Event> {
    try {
      for await (const evt of this.sub) {
        try {
          if (isCommit(evt) && !this.opts.excludeCommit) {
            const parsed = this.opts.unauthenticated
              ? await parseCommitUnauthenticated(evt)
              : await parseCommitAuthenticated(this.opts.idResolver, evt)
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
          if (this.opts.onError) {
            this.opts.onError('parse', err)
          }
        }
      }
    } catch (err) {
      if (err && err['name'] === 'AbortError') {
        this.destoryDefer.resolve()
        return
      }
      if (this.opts.onError) {
        this.opts.onError('subscription', err)
      }
      await wait(3000)
      return this
    }
  }

  async destroy(): Promise<void> {
    this.abortController.abort()
    await this.destoryDefer.complete
  }
}

export const parseCommitAuthenticated = async (
  idResolver: IdResolver,
  evt: Commit,
  forceKeyRefresh = false,
): Promise<CommitEvt[]> => {
  const did = evt.repo
  const key = await idResolver.did.resolveAtprotoKey(did, forceKeyRefresh)
  const claims = evt.ops.map((op) => {
    const { collection, rkey } = parseDataKey(op.path)
    return {
      collection,
      rkey,
      cid: op.action === 'delete' ? null : op.cid,
    }
  })
  const verifiedCids: Record<string, CID | null> = {}
  try {
    const results = await verifyProofs(evt.blocks, claims, did, key)
    results.verified.forEach((op) => {
      const path = formatDataKey(op.collection, op.rkey)
      verifiedCids[path] = op.cid
    })
  } catch (err) {
    if (err instanceof RepoVerificationError) {
      return parseCommitAuthenticated(idResolver, evt, true)
    }
    throw err
  }
  const verifiedOps: RepoOp[] = evt.ops.filter((op) => {
    if (op.action === 'delete') {
      return verifiedCids[op.path] === null
    } else {
      return op.cid !== null && op.cid.equals(verifiedCids[op.path])
    }
  })
  return formatCommitOps(evt, verifiedOps)
}

export const parseCommitUnauthenticated = async (
  evt: Commit,
): Promise<CommitEvt[]> => {
  return formatCommitOps(evt, evt.ops)
}

const formatCommitOps = async (evt: Commit, ops: RepoOp[]) => {
  const car = await readCar(evt.blocks)

  const evts: CommitEvt[] = []

  for (const op of ops) {
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

export type FirehoseErrorType = 'validation' | 'parse' | 'subscription'
