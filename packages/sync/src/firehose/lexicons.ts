import type { IncomingMessage } from 'node:http'

import { type LexiconDoc, Lexicons } from '@atproto/lexicon'
import type { ErrorFrame, HandlerAuth } from '@atproto/xrpc-server'
import type { CID } from 'multiformats/cid'

// @NOTE: this file is an ugly copy job of codegen output. I'd like to clean this whole thing up

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function hasProp<K extends PropertyKey>(
  data: object,
  prop: K,
): data is Record<K, unknown> {
  return prop in data
}

export interface QueryParams {
  /** The last known event seq number to backfill from. */
  cursor?: number
}

export type RepoEvent =
  | Commit
  | Identity
  | Account
  | Handle
  | Migrate
  | Tombstone
  | Info
  | { $type: string; [k: string]: unknown }
export type HandlerError = ErrorFrame<'FutureCursor' | 'ConsumerTooSlow'>
export type HandlerOutput = HandlerError | RepoEvent
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  req: IncomingMessage
  signal: AbortSignal
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => AsyncIterable<HandlerOutput>

/** Represents an update of repository state. Note that empty commits are allowed, which include no repo data changes, but an update to rev and signature. */
export interface Commit {
  /** The stream sequence number of this message. */
  seq: number
  /** DEPRECATED -- unused */
  rebase: boolean
  /** Indicates that this commit contained too many ops, or data size was too large. Consumers will need to make a separate request to get missing data. */
  tooBig: boolean
  /** The repo this event comes from. */
  repo: string
  /** Repo commit object CID. */
  commit: CID
  /** DEPRECATED -- unused. WARNING -- nullable and optional; stick with optional to ensure golang interoperability. */
  prev?: CID | null
  /** The rev of the emitted commit. Note that this information is also in the commit object included in blocks, unless this is a tooBig event. */
  rev: string
  /** The rev of the last emitted commit from this repo (if any). */
  since: string | null
  /** CAR file containing relevant blocks, as a diff since the previous repo state. */
  blocks: Uint8Array
  ops: RepoOp[]
  blobs: CID[]
  /** Timestamp of when this message was originally broadcast. */
  time: string
  [k: string]: unknown
}

export function isCommit(v: unknown): v is Commit {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#commit'
  )
}

/** Represents a change to an account's identity. Could be an updated handle, signing key, or pds hosting endpoint. Serves as a prod to all downstream services to refresh their identity cache. */
export interface Identity {
  seq: number
  did: string
  time: string
  /** The current handle for the account, or 'handle.invalid' if validation fails. This field is optional, might have been validated or passed-through from an upstream source. Semantics and behaviors for PDS vs Relay may evolve in the future; see atproto specs for more details. */
  handle?: string
  [k: string]: unknown
}

export function isIdentity(v: unknown): v is Identity {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#identity'
  )
}

/** Represents a change to an account's status on a host (eg, PDS or Relay). The semantics of this event are that the status is at the host which emitted the event, not necessarily that at the currently active PDS. Eg, a Relay takedown would emit a takedown with active=false, even if the PDS is still active. */
export interface Account {
  seq: number
  did: string
  time: string
  /** Indicates that the account has a repository which can be fetched from the host that emitted this event. */
  active: boolean
  /** If active=false, this optional field indicates a reason for why the account is not active. */
  status?: 'takendown' | 'suspended' | 'deleted' | 'deactivated' | string
  [k: string]: unknown
}

export function isAccount(v: unknown): v is Account {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#account'
  )
}

/** DEPRECATED -- Use #identity event instead */
export interface Handle {
  seq: number
  did: string
  handle: string
  time: string
  [k: string]: unknown
}

export function isHandle(v: unknown): v is Handle {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#handle'
  )
}

/** DEPRECATED -- Use #account event instead */
export interface Migrate {
  seq: number
  did: string
  migrateTo: string | null
  time: string
  [k: string]: unknown
}

export function isMigrate(v: unknown): v is Migrate {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#migrate'
  )
}

/** DEPRECATED -- Use #account event instead */
export interface Tombstone {
  seq: number
  did: string
  time: string
  [k: string]: unknown
}

export function isTombstone(v: unknown): v is Tombstone {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#tombstone'
  )
}

export interface Info {
  name: 'OutdatedCursor' | string
  message?: string
  [k: string]: unknown
}

export function isInfo(v: unknown): v is Info {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#info'
  )
}

/** A repo operation, ie a mutation of a single record. */
export interface RepoOp {
  action: 'create' | 'update' | 'delete' | string
  path: string
  /** For creates and updates, the new record CID. For deletions, null. */
  cid: CID | null
  [k: string]: unknown
}

export function isRepoOp(v: unknown): v is RepoOp {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#repoOp'
  )
}

export const ComAtprotoSyncSubscribeRepos: LexiconDoc = {
  lexicon: 1,
  id: 'com.atproto.sync.subscribeRepos',
  defs: {
    main: {
      type: 'subscription',
      description: 'Subscribe to repo updates',
      parameters: {
        type: 'params',
        properties: {
          cursor: {
            type: 'integer',
            description: 'The last known event to backfill from.',
          },
        },
      },
      message: {
        schema: {
          type: 'union',
          refs: [
            'lex:com.atproto.sync.subscribeRepos#commit',
            'lex:com.atproto.sync.subscribeRepos#handle',
            'lex:com.atproto.sync.subscribeRepos#migrate',
            'lex:com.atproto.sync.subscribeRepos#tombstone',
            'lex:com.atproto.sync.subscribeRepos#info',
          ],
        },
      },
      errors: [
        {
          name: 'FutureCursor',
        },
        {
          name: 'ConsumerTooSlow',
        },
      ],
    },
    commit: {
      type: 'object',
      required: [
        'seq',
        'rebase',
        'tooBig',
        'repo',
        'commit',
        'rev',
        'since',
        'blocks',
        'ops',
        'blobs',
        'time',
      ],
      nullable: ['prev', 'since'],
      properties: {
        seq: {
          type: 'integer',
        },
        rebase: {
          type: 'boolean',
        },
        tooBig: {
          type: 'boolean',
        },
        repo: {
          type: 'string',
          format: 'did',
        },
        commit: {
          type: 'cid-link',
        },
        prev: {
          type: 'cid-link',
        },
        rev: {
          type: 'string',
          description: 'The rev of the emitted commit',
        },
        since: {
          type: 'string',
          description: 'The rev of the last emitted commit from this repo',
        },
        blocks: {
          type: 'bytes',
          description: 'CAR file containing relevant blocks',
          maxLength: 1000000,
        },
        ops: {
          type: 'array',
          items: {
            type: 'ref',
            ref: 'lex:com.atproto.sync.subscribeRepos#repoOp',
          },
          maxLength: 200,
        },
        blobs: {
          type: 'array',
          items: {
            type: 'cid-link',
          },
        },
        time: {
          type: 'string',
          format: 'datetime',
        },
      },
    },
    handle: {
      type: 'object',
      required: ['seq', 'did', 'handle', 'time'],
      properties: {
        seq: {
          type: 'integer',
        },
        did: {
          type: 'string',
          format: 'did',
        },
        handle: {
          type: 'string',
          format: 'handle',
        },
        time: {
          type: 'string',
          format: 'datetime',
        },
      },
    },
    migrate: {
      type: 'object',
      required: ['seq', 'did', 'migrateTo', 'time'],
      nullable: ['migrateTo'],
      properties: {
        seq: {
          type: 'integer',
        },
        did: {
          type: 'string',
          format: 'did',
        },
        migrateTo: {
          type: 'string',
        },
        time: {
          type: 'string',
          format: 'datetime',
        },
      },
    },
    tombstone: {
      type: 'object',
      required: ['seq', 'did', 'time'],
      properties: {
        seq: {
          type: 'integer',
        },
        did: {
          type: 'string',
          format: 'did',
        },
        time: {
          type: 'string',
          format: 'datetime',
        },
      },
    },
    info: {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          knownValues: ['OutdatedCursor'],
        },
        message: {
          type: 'string',
        },
      },
    },
    repoOp: {
      type: 'object',
      description:
        "A repo operation, ie a write of a single record. For creates and updates, cid is the record's CID as of this operation. For deletes, it's null.",
      required: ['action', 'path', 'cid'],
      nullable: ['cid'],
      properties: {
        action: {
          type: 'string',
          knownValues: ['create', 'update', 'delete'],
        },
        path: {
          type: 'string',
        },
        cid: {
          type: 'cid-link',
        },
      },
    },
  },
}

const lexicons = new Lexicons([ComAtprotoSyncSubscribeRepos])

export const isValidRepoEvent = (evt: unknown) => {
  return lexicons.assertValidXrpcMessage<RepoEvent>(
    'com.atproto.sync.subscribeRepos',
    evt,
  )
}
