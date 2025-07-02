import type { IncomingMessage } from 'node:http'
import type { CID } from 'multiformats/cid'
import { type LexiconDoc, Lexicons } from '@atproto/lexicon'
import type { Auth, ErrorFrame } from '@atproto/xrpc-server'

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
  | Sync
  | Info
  | { $type: string; [k: string]: unknown }
export type HandlerError = ErrorFrame<'FutureCursor' | 'ConsumerTooSlow'>
export type HandlerOutput = HandlerError | RepoEvent
export type HandlerReqCtx<HA extends Auth = never> = {
  auth: HA
  params: QueryParams
  req: IncomingMessage
  signal: AbortSignal
}
export type Handler<HA extends Auth = never> = (
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

/** Updates the repo to a new state, without necessarily including that state on the firehose. Used to recover from broken commit streams, data loss incidents, or in situations where upstream host does not know recent state of the repository. */
export interface Sync {
  $type?: 'com.atproto.sync.subscribeRepos#sync'
  /** The stream sequence number of this message. */
  seq: number
  /** The account this repo event corresponds to. Must match that in the commit object. */
  did: string
  /** CAR file containing the commit, as a block. The CAR header must include the commit block CID as the first 'root'. */
  blocks: Uint8Array
  /** The rev of the commit. This value must match that in the commit object. */
  rev: string
  /** Timestamp of when this message was originally broadcast. */
  time: string
}

export function isSync(v: unknown): v is Sync {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#sync'
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
      description:
        'Repository event stream, aka Firehose endpoint. Outputs repo commits with diff data, and identity update events, for all repositories on the current server. See the atproto specifications for details around stream sequencing, repo versioning, CAR diff format, and more. Public and does not require auth; implemented by PDS and Relay.',
      parameters: {
        type: 'params',
        properties: {
          cursor: {
            type: 'integer',
            description: 'The last known event seq number to backfill from.',
          },
        },
      },
      message: {
        schema: {
          type: 'union',
          refs: [
            'lex:com.atproto.sync.subscribeRepos#commit',
            'lex:com.atproto.sync.subscribeRepos#sync',
            'lex:com.atproto.sync.subscribeRepos#identity',
            'lex:com.atproto.sync.subscribeRepos#account',
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
          description:
            'If the consumer of the stream can not keep up with events, and a backlog gets too large, the server will drop the connection.',
        },
      ],
    },
    commit: {
      type: 'object',
      description:
        'Represents an update of repository state. Note that empty commits are allowed, which include no repo data changes, but an update to rev and signature.',
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
      nullable: ['since'],
      properties: {
        seq: {
          type: 'integer',
          description: 'The stream sequence number of this message.',
        },
        rebase: {
          type: 'boolean',
          description: 'DEPRECATED -- unused',
        },
        tooBig: {
          type: 'boolean',
          description:
            'DEPRECATED -- replaced by #sync event and data limits. Indicates that this commit contained too many ops, or data size was too large. Consumers will need to make a separate request to get missing data.',
        },
        repo: {
          type: 'string',
          format: 'did',
          description:
            "The repo this event comes from. Note that all other message types name this field 'did'.",
        },
        commit: {
          type: 'cid-link',
          description: 'Repo commit object CID.',
        },
        rev: {
          type: 'string',
          format: 'tid',
          description:
            'The rev of the emitted commit. Note that this information is also in the commit object included in blocks, unless this is a tooBig event.',
        },
        since: {
          type: 'string',
          format: 'tid',
          description:
            'The rev of the last emitted commit from this repo (if any).',
        },
        blocks: {
          type: 'bytes',
          description:
            "CAR file containing relevant blocks, as a diff since the previous repo state. The commit must be included as a block, and the commit block CID must be the first entry in the CAR header 'roots' list.",
          maxLength: 2000000,
        },
        ops: {
          type: 'array',
          items: {
            type: 'ref',
            ref: 'lex:com.atproto.sync.subscribeRepos#repoOp',
            description:
              'List of repo mutation operations in this commit (eg, records created, updated, or deleted).',
          },
          maxLength: 200,
        },
        blobs: {
          type: 'array',
          items: {
            type: 'cid-link',
            description:
              'DEPRECATED -- will soon always be empty. List of new blobs (by CID) referenced by records in this commit.',
          },
        },
        prevData: {
          type: 'cid-link',
          description:
            "The root CID of the MST tree for the previous commit from this repo (indicated by the 'since' revision field in this message). Corresponds to the 'data' field in the repo commit object. NOTE: this field is effectively required for the 'inductive' version of firehose.",
        },
        time: {
          type: 'string',
          format: 'datetime',
          description:
            'Timestamp of when this message was originally broadcast.',
        },
      },
    },
    sync: {
      type: 'object',
      description:
        'Updates the repo to a new state, without necessarily including that state on the firehose. Used to recover from broken commit streams, data loss incidents, or in situations where upstream host does not know recent state of the repository.',
      required: ['seq', 'did', 'blocks', 'rev', 'time'],
      properties: {
        seq: {
          type: 'integer',
          description: 'The stream sequence number of this message.',
        },
        did: {
          type: 'string',
          format: 'did',
          description:
            'The account this repo event corresponds to. Must match that in the commit object.',
        },
        blocks: {
          type: 'bytes',
          description:
            "CAR file containing the commit, as a block. The CAR header must include the commit block CID as the first 'root'.",
          maxLength: 10000,
        },
        rev: {
          type: 'string',
          description:
            'The rev of the commit. This value must match that in the commit object.',
        },
        time: {
          type: 'string',
          format: 'datetime',
          description:
            'Timestamp of when this message was originally broadcast.',
        },
      },
    },
    identity: {
      type: 'object',
      description:
        "Represents a change to an account's identity. Could be an updated handle, signing key, or pds hosting endpoint. Serves as a prod to all downstream services to refresh their identity cache.",
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
        handle: {
          type: 'string',
          format: 'handle',
          description:
            "The current handle for the account, or 'handle.invalid' if validation fails. This field is optional, might have been validated or passed-through from an upstream source. Semantics and behaviors for PDS vs Relay may evolve in the future; see atproto specs for more details.",
        },
      },
    },
    account: {
      type: 'object',
      description:
        "Represents a change to an account's status on a host (eg, PDS or Relay). The semantics of this event are that the status is at the host which emitted the event, not necessarily that at the currently active PDS. Eg, a Relay takedown would emit a takedown with active=false, even if the PDS is still active.",
      required: ['seq', 'did', 'time', 'active'],
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
        active: {
          type: 'boolean',
          description:
            'Indicates that the account has a repository which can be fetched from the host that emitted this event.',
        },
        status: {
          type: 'string',
          description:
            'If active=false, this optional field indicates a reason for why the account is not active.',
          knownValues: [
            'takendown',
            'suspended',
            'deleted',
            'deactivated',
            'desynchronized',
            'throttled',
          ],
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
      description: 'A repo operation, ie a mutation of a single record.',
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
          description:
            'For creates and updates, the new record CID. For deletions, null.',
        },
        prev: {
          type: 'cid-link',
          description:
            'For updates and deletes, the previous record CID (required for inductive firehose). For creations, field should not be defined.',
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
