import {
  type DidDocument,
  getKemDidKey,
  getPdsEndpoint,
} from '@atproto/common-web'
import type { Keypair } from '@atproto/crypto'
import { lexParse } from '@atproto/lex-json'
import {
  type DidString,
  type NsidString,
  type RecordKeyString,
  type SpaceAtUriString,
  SpaceRef,
  type SpaceRefString,
  isValidDid,
} from '@atproto/syntax'
import { SpaceKemError, SpaceMacError, SpaceResponseError } from './error.js'
import { createSpaceSigHeaders } from './http-signature.js'
import { encapsulate } from './kem.js'
import {
  COMMIT_MAC_TYPE,
  MAC_HEADER,
  MAC_TYPE_BY_METHOD,
  RECORD_MAC_TYPE,
  WANT_MAC_HEADER,
  formatWantMacHeader,
  parseMacHeader,
} from './mac.js'
import { verifyCommit } from './repo-commit.js'
import {
  type VerifiedSpaceRepo,
  verifyRecord,
  verifyRepoStar,
} from './sync/consumer.js'
import type { SpaceCommit, SpaceRecord } from './types.js'

const GET_RECORD = 'com.atproto.space.getRecord'
const GET_LATEST_COMMIT = 'com.atproto.space.getLatestCommit'
const LIST_REPO_OPS = 'com.atproto.space.listRepoOps'
const GET_REPO = 'com.atproto.space.getRepo'

export type SpaceCredentialAgentOptions = {
  /** A space credential, as issued by the space's authority. */
  credential: string
  /** The P-256 key the credential is bound to (its `cnf.kid`). */
  keypair: Keypair
  resolveDidDoc: (did: DidString) => Promise<DidDocument>
  fetch?: typeof globalThis.fetch
}

type SpaceRequest = {
  nsid: string
  params: Record<string, unknown>
}

/**
 * Makes requests to a space's repo hosts with a space credential. Each request
 * is signed for its audience and sent to the audience's PDS, and the MAC on each
 * response that carries one is verified before the response is returned.
 *
 * Implements lex-client's `Agent`, so it can back a `Client`. `getRepo` streams
 * a repo that can only be verified as it is read, so call it through
 * {@link SpaceCredentialAgent#getRepo} instead.
 *
 * @example
 * ```ts
 * const agent = new SpaceCredentialAgent({ credential, keypair, resolveDidDoc })
 * const client = new Client(agent)
 * const record = await client.call(com.atproto.space.getRecord, params)
 * ```
 */
export class SpaceCredentialAgent {
  readonly did = undefined

  constructor(private readonly options: SpaceCredentialAgentOptions) {}

  async fetchHandler(path: `/${string}`, init: RequestInit): Promise<Response> {
    const request = parseRequest(path, init)
    if (request.nsid === GET_REPO) {
      throw new Error(
        'getRepo cannot be verified before it is returned: use SpaceCredentialAgent#getRepo()',
      )
    }

    const { response, sharedSecret } = await this.send(path, init, request)
    // An error response has nothing to authenticate, so lex-client raises it as is.
    if (sharedSecret && response.ok) {
      await verifyResponse(request, response, sharedSecret)
    }
    return response
  }

  /**
   * Fetch a repo. Its commit is verified up front, and its records as they are
   * read: see {@link verifyRepoStar}.
   */
  async getRepo(params: {
    space: SpaceRefString
    repo: DidString
  }): Promise<VerifiedSpaceRepo> {
    const path = `/xrpc/${GET_REPO}?${new URLSearchParams(params)}` as const
    const init: RequestInit = { method: 'GET' }
    const { response, sharedSecret } = await this.send(path, init, {
      nsid: GET_REPO,
      params,
    })
    if (!response.ok || !response.body) {
      throw await toResponseError(response)
    }

    let mac: Uint8Array
    try {
      mac = parseMacHeader(response.headers.get(MAC_HEADER), COMMIT_MAC_TYPE)
    } catch (err) {
      await response.body.cancel()
      throw err
    }
    // getRepo is a MAC method, so `send` always requested one.
    return verifyRepoStar(response.body, {
      ...params,
      sharedSecret: sharedSecret!,
      mac,
    })
  }

  private async send(
    path: `/${string}`,
    init: RequestInit,
    request: SpaceRequest,
  ): Promise<{ response: Response; sharedSecret?: Uint8Array }> {
    const audience = requestAudience(request.params)
    const didDoc = await this.options.resolveDidDoc(audience)
    const endpoint = getPdsEndpoint(didDoc)
    if (!endpoint) {
      throw new Error(`no PDS endpoint for ${audience}`)
    }

    const headers = new Headers(init.headers)
    const sig = await createSpaceSigHeaders({
      authorization: `Atproto-Space-Credential ${this.options.credential}`,
      audience,
      keypair: this.options.keypair,
    })
    for (const [name, value] of Object.entries(sig.headers)) {
      headers.set(name, value)
    }

    let sharedSecret: Uint8Array | undefined
    const macType = MAC_TYPE_BY_METHOD[request.nsid]
    if (macType) {
      const kemKey = getKemDidKey(didDoc)
      if (!isValidDid(kemKey)) {
        throw new SpaceKemError(`no #atproto_kem key for ${audience}`)
      }
      const encapsulation = await encapsulate(kemKey)
      sharedSecret = encapsulation.sharedSecret
      headers.set(
        WANT_MAC_HEADER,
        formatWantMacHeader(macType, encapsulation.keyShare),
      )
    }

    const fetch = this.options.fetch ?? globalThis.fetch
    const response = await fetch(new URL(path, endpoint), { ...init, headers })
    return { response, sharedSecret }
  }
}

// Keeps the XRPC error code, which tells a syncer what to do (e.g. drop a repo
// that is `RepoTakendown`, or retry one that failed).
async function toResponseError(
  response: Response,
): Promise<SpaceResponseError> {
  const body = await response.json().catch(() => undefined)
  return new SpaceResponseError(
    response.status,
    typeof body?.error === 'string' ? body.error : 'UnknownError',
    typeof body?.message === 'string'
      ? body.message
      : `request failed with status ${response.status}`,
  )
}

function parseRequest(path: `/${string}`, init: RequestInit): SpaceRequest {
  // Only the path and query are read, so any base will do.
  const url = new URL(path, 'http://localhost')
  const nsid = url.pathname.replace(/^\/xrpc\//, '')
  const params =
    init.method === 'POST' && typeof init.body === 'string'
      ? JSON.parse(init.body)
      : Object.fromEntries(url.searchParams)
  return { nsid, params }
}

// A request about one repo goes to that repo's host. Anything else is about the
// space, and goes to the space's authority.
function requestAudience(params: Record<string, unknown>): DidString {
  const { repo, space } = params
  if (repo !== undefined) {
    if (!isValidDid(repo)) {
      throw new TypeError(`invalid repo DID: ${repo}`)
    }
    return repo
  }
  if (typeof space !== 'string') {
    throw new TypeError('a space request must name a repo or a space')
  }
  return SpaceRef.parse(space).spaceDid
}

async function verifyResponse(
  request: SpaceRequest,
  response: Response,
  sharedSecret: Uint8Array,
): Promise<void> {
  // Read a copy, leaving the original body for the caller.
  const text = await response.clone().text()
  const macHeader = response.headers.get(MAC_HEADER)
  const space = request.params.space as SpaceRefString
  const repo = request.params.repo as DidString

  switch (request.nsid) {
    case GET_RECORD: {
      const record = lexParse<{ uri: string; cid: string; value: SpaceRecord }>(
        text,
      )
      const uri = SpaceRef.parse(space).recordUri(
        repo,
        request.params.collection as NsidString,
        request.params.rkey as RecordKeyString,
      )
      await verifyRecord(record, {
        uri: uri.toString() as SpaceAtUriString,
        sharedSecret,
        mac: parseMacHeader(macHeader, RECORD_MAC_TYPE),
      })
      return
    }
    case GET_LATEST_COMMIT: {
      const { commit } = lexParse<{ commit: SpaceCommit }>(text)
      verifyCommit(commit, {
        space,
        repo,
        sharedSecret,
        mac: parseMacHeader(macHeader, COMMIT_MAC_TYPE),
      })
      return
    }
    case LIST_REPO_OPS: {
      // Only a page that reaches the head of the oplog carries the commit, and
      // with it a MAC.
      const { commit } = lexParse<{ commit?: SpaceCommit }>(text)
      if (commit) {
        verifyCommit(commit, {
          space,
          repo,
          sharedSecret,
          mac: parseMacHeader(macHeader, COMMIT_MAC_TYPE),
        })
      }
      return
    }
    default:
      // A MAC was requested, so the response must not be returned unverified.
      throw new SpaceMacError(`no MAC verifier for ${request.nsid}`)
  }
}
