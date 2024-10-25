import { createDeferrable, Deferrable, wait } from '@atproto/common'
import {
  IdResolver,
  parseToAtprotoDocument,
  DidDocument,
} from '@atproto/identity'
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
} from '../events'
import { CID } from 'multiformats/cid'
import { EventRunner } from '../runner'
import { didAndSeqForEvt } from '../util'

export type FirehoseOptions = {
  idResolver: IdResolver

  handleEvent: (evt: Event) => Awaited<void>
  onError: (err: Error) => void
  getCursor?: () => Awaited<number | undefined>

  runner?: EventRunner // should only set getCursor *or* runner

  service?: string
  subscriptionReconnectDelay?: number

  unauthenticatedCommits?: boolean
  unauthenticatedHandles?: boolean

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
    if (this.opts.getCursor && this.opts.runner) {
      throw new Error('Must set only `getCursor` or `runner`')
    }
    this.sub = new Subscription({
      service: opts.service ?? 'wss://bsky.network',
      method: 'com.atproto.sync.subscribeRepos',
      signal: this.abortController.signal,
      getParams: async () => {
        const getCursorFn = () =>
          this.opts.runner?.getCursor() ?? this.opts.getCursor
        if (!getCursorFn) {
          return undefined
        }
        const cursor = await getCursorFn()
        return { cursor }
      },
      validate: (value: unknown) => {
        try {
          return isValidRepoEvent(value)
        } catch (err) {
          this.opts.onError(new FirehoseValidationError(err, value))
        }
      },
    })
  }

  async start() {
    try {
      for await (const evt of this.sub) {
        if (this.opts.runner) {
          const parsed = didAndSeqForEvt(evt)
          if (!parsed) {
            continue
          }
          this.opts.runner.trackEvent(parsed.did, parsed.seq, async () => {
            const parsed = await this.parseEvt(evt)
            for (const write of parsed) {
              try {
                await this.opts.handleEvent(write)
              } catch (err) {
                this.opts.onError(new FirehoseHandlerError(err, write))
              }
            }
          })
        } else {
          await this.processEvt(evt)
        }
      }
    } catch (err) {
      if (err && err['name'] === 'AbortError') {
        this.destoryDefer.resolve()
        return
      }
      this.opts.onError(new FirehoseSubscriptionError(err))
      await wait(this.opts.subscriptionReconnectDelay ?? 3000)
      return this.start()
    }
  }

  private async parseEvt(evt: RepoEvent): Promise<Event[]> {
    try {
      if (isCommit(evt) && !this.opts.excludeCommit) {
        return this.opts.unauthenticatedCommits
          ? await parseCommitUnauthenticated(evt, this.opts.filterCollections)
          : await parseCommitAuthenticated(
              this.opts.idResolver,
              evt,
              this.opts.filterCollections,
            )
      } else if (isAccount(evt) && !this.opts.excludeAccount) {
        const parsed = parseAccount(evt)
        return parsed ? [parsed] : []
      } else if (isIdentity(evt) && !this.opts.excludeIdentity) {
        const parsed = await parseIdentity(
          this.opts.idResolver,
          evt,
          this.opts.unauthenticatedHandles,
        )
        return parsed ? [parsed] : []
      } else {
        return []
      }
    } catch (err) {
      this.opts.onError(new FirehoseParseError(err, evt))
      return []
    }
  }

  private async processEvt(evt: RepoEvent) {
    const parsed = await this.parseEvt(evt)
    for (const write of parsed) {
      try {
        await this.opts.handleEvent(write)
      } catch (err) {
        this.opts.onError(new FirehoseHandlerError(err, write))
      }
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
  filterCollections?: string[],
  forceKeyRefresh = false,
): Promise<CommitEvt[]> => {
  const did = evt.repo
  const ops = maybeFilterOps(evt.ops, filterCollections)
  if (ops.length === 0) {
    return []
  }
  const claims = ops.map((op) => {
    const { collection, rkey } = parseDataKey(op.path)
    return {
      collection,
      rkey,
      cid: op.action === 'delete' ? null : op.cid,
    }
  })
  const key = await idResolver.did.resolveAtprotoKey(did, forceKeyRefresh)
  const verifiedCids: Record<string, CID | null> = {}
  try {
    const results = await verifyProofs(evt.blocks, claims, did, key)
    results.verified.forEach((op) => {
      const path = formatDataKey(op.collection, op.rkey)
      verifiedCids[path] = op.cid
    })
  } catch (err) {
    if (err instanceof RepoVerificationError && !forceKeyRefresh) {
      return parseCommitAuthenticated(idResolver, evt, filterCollections, true)
    }
    throw err
  }
  const verifiedOps: RepoOp[] = ops.filter((op) => {
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
  filterCollections?: string[],
): Promise<CommitEvt[]> => {
  const ops = maybeFilterOps(evt.ops, filterCollections)
  return formatCommitOps(evt, ops)
}

const maybeFilterOps = (
  ops: RepoOp[],
  filterCollections?: string[],
): RepoOp[] => {
  if (!filterCollections) return ops
  return ops.filter((op) => {
    const { collection } = parseDataKey(op.path)
    return filterCollections.includes(collection)
  })
}

const formatCommitOps = async (evt: Commit, ops: RepoOp[]) => {
  const car = await readCar(evt.blocks)

  const evts: CommitEvt[] = []

  for (const op of ops) {
    const uri = AtUri.make(evt.repo, op.path)

    const meta: CommitMeta = {
      seq: evt.seq,
      time: evt.time,
      commit: evt.commit,
      blocks: car.blocks,
      rev: evt.rev,
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

export const parseIdentity = async (
  idResolver: IdResolver,
  evt: Identity,
  unauthenticated = false,
): Promise<IdentityEvt | null> => {
  const res = await idResolver.did.resolve(evt.did)
  const handle =
    res && !unauthenticated
      ? await verifyHandle(idResolver, evt.did, res)
      : undefined

  return {
    event: 'identity',
    seq: evt.seq,
    time: evt.time,
    did: evt.did,
    handle,
    didDocument: res ?? undefined,
  }
}

const verifyHandle = async (
  idResolver: IdResolver,
  did: string,
  didDoc: DidDocument,
): Promise<string | undefined> => {
  const { handle } = parseToAtprotoDocument(didDoc)
  if (!handle) {
    return undefined
  }
  const res = await idResolver.handle.resolve(handle)
  return res === did ? handle : undefined
}

export const parseAccount = (evt: Account): AccountEvt | undefined => {
  if (evt.status && !isValidStatus(evt.status)) return
  return {
    event: 'account',
    seq: evt.seq,
    time: evt.time,
    did: evt.did,
    active: evt.active,
    status: evt.status as AccountStatus | undefined,
  }
}

const isValidStatus = (str: string): str is AccountStatus => {
  return ['takendown', 'suspended', 'deleted', 'deactivated'].includes(str)
}

export class FirehoseValidationError extends Error {
  constructor(
    err: unknown,
    public value: unknown,
  ) {
    super('error in firehose event lexicon validation', { cause: err })
  }
}

export class FirehoseParseError extends Error {
  constructor(
    err: unknown,
    public event: RepoEvent,
  ) {
    super('error in parsing and authenticating firehose event', { cause: err })
  }
}

export class FirehoseSubscriptionError extends Error {
  constructor(err: unknown) {
    super('error on firehose subscription', { cause: err })
  }
}

export class FirehoseHandlerError extends Error {
  constructor(
    err: unknown,
    public event: Event,
  ) {
    super('error in firehose event handler', { cause: err })
  }
}
