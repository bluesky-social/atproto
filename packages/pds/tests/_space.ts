import { once } from 'node:events'
import { Server, createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import * as plc from '@did-plc/lib'
import { HttpTerminator, createHttpTerminator } from 'http-terminator'
import { Secp256k1Keypair } from '@atproto/crypto'
import {
  EXAMPLE_LABELER,
  SeedClient,
  TestNetworkNoAppView,
  TestPds,
} from '@atproto/dev-env'
import { Client, DidString } from '@atproto/lex'
import { LexMap, parseCid } from '@atproto/lex-data'
import { JoseKey } from '@atproto/oauth-provider'
import { RepoCommit, createDpopProof, dpopJktForKey } from '@atproto/space'
import {
  NsidString,
  RecordKeyString,
  SpaceRef,
  SpaceRefString,
} from '@atproto/syntax'
import { ClientAttestationVerifier } from '../src/client-attestation-verifier.js'
import { com } from '../src/lexicons/index.js'

// Third-party collections, as a space's are in practice. The PDS validates
// records against a hardcoded schema map (see `repo/prepare.ts`), so anything
// outside it reports `validationStatus: 'unknown'` — which is also what a
// third-party collection would do in production.
export const TEST_COLLECTION = 'com.example.spaceRecord' as NsidString
export const TEST_COLLECTION_ALT = 'com.example.spaceNote' as NsidString

// The space type used by default. `com.example.group` is published as a `space`
// lexicon by the dev-env lex authority, so an OAuth grant naming it can resolve
// its declared collections — but only on a network created with
// `lexiconAuthority: true`.
export const TEST_SPACE_TYPE = 'com.example.group' as NsidString
export const SPACE_TYPE_COLLECTIONS = [
  'com.example.groupNote',
  'com.example.groupPost',
] as NsidString[]

/** An account, with everything needed to act as it. */
export type Actor = {
  name: string
  did: DidString
  headers: { authorization: string }
  pds: TestPds
  client: Client
}

export type SpaceOptions = {
  /** Defaults to a slug derived from the current test's name. */
  skey?: string
  type?: NsidString
  members?: Actor[]
  policy?: com.atproto.simplespace.createSpace.$InputBody['policy']
  appAccess?: com.atproto.simplespace.createSpace.$InputBody['appAccess']
  /** Skip `simplespace.createSpace`, leaving the space ungoverned. */
  ungoverned?: boolean
}

export type WriteOptions = {
  collection?: NsidString
  rkey?: string
  text?: string
  record?: LexMap
  validate?: boolean
  /** Authenticate as something other than the actor's own session. */
  headers?: { authorization: string }
}

const { defs } = com.atproto.simplespace

/**
 * Test helper for permissioned spaces, in the spirit of `SeedClient`.
 *
 * Owns the two things that otherwise dominate a space test: the boilerplate of a
 * space write, and the two-hop delegation-token → credential exchange. Every
 * method takes an {@link Actor} so a call site reads as who is doing what, rather
 * than threading did/headers/client separately.
 */
export class SpaceClient {
  constructor(public network: TestNetworkNoAppView) {}

  /** The space authority in these tests: alice, on pds1. */
  get authority(): TestPds {
    return this.network.pds
  }

  async createActor(
    name: string,
    pds: TestPds,
    domain = 'test',
  ): Promise<Actor> {
    const agent = pds.getAgent()
    const res = await agent.com.atproto.server.createAccount({
      handle: `${name}.${domain}`,
      email: `${name}@test.com`,
      password: `${name}-pass`,
    })
    return {
      name,
      did: res.data.did as DidString,
      headers: SeedClient.getHeaders(res.data.accessJwt),
      pds,
      client: pds.getClient(),
    }
  }

  /**
   * Create a space owned by `owner`, optionally adding members.
   *
   * The skey defaults to a slug of the running test's name, so tests don't have
   * to invent one and restate their own title. Each test gets a distinct space,
   * which is what keeps them order-independent.
   */
  async createSpace(
    owner: Actor,
    opts: SpaceOptions = {},
  ): Promise<SpaceRefString> {
    const skey = opts.skey ?? currentTestSkey()
    const type = opts.type ?? TEST_SPACE_TYPE

    const uri = `at://${owner.did}/space/${type}/${skey}` as SpaceRefString

    if (!opts.ungoverned) {
      const res = await owner.client.call(
        com.atproto.simplespace.createSpace,
        {
          type,
          skey,
          policy: opts.policy ?? defs.memberListPolicy.build({}),
          appAccess: opts.appAccess ?? defs.open.build({}),
        },
        { headers: owner.headers },
      )
      // Belt and braces: if the handler ever stops anchoring on the caller's own
      // DID, every test built on this helper would silently target a stale uri.
      if (res.uri !== uri) {
        throw new Error(`expected space ${uri}, got ${res.uri}`)
      }
    }

    for (const member of opts.members ?? []) {
      await this.addMember(owner, uri, member)
    }
    return uri
  }

  async addMember(owner: Actor, space: SpaceRefString, member: Actor) {
    return owner.client.call(
      com.atproto.simplespace.addMember,
      { space, did: member.did },
      { headers: owner.headers },
    )
  }

  async removeMember(owner: Actor, space: SpaceRefString, member: Actor) {
    return owner.client.call(
      com.atproto.simplespace.removeMember,
      { space, did: member.did },
      { headers: owner.headers },
    )
  }

  /** Write one record to `actor`'s own repo in the space. */
  async write(actor: Actor, space: SpaceRefString, opts: WriteOptions = {}) {
    const collection = opts.collection ?? TEST_COLLECTION
    return actor.client.call(
      com.atproto.space.createRecord,
      {
        space,
        repo: actor.did,
        collection,
        rkey: opts.rkey as RecordKeyString | undefined,
        record: opts.record ?? record(collection, opts.text),
        validate: opts.validate,
      },
      { headers: opts.headers ?? actor.headers },
    )
  }

  async put(actor: Actor, space: SpaceRefString, opts: WriteOptions = {}) {
    const collection = opts.collection ?? TEST_COLLECTION
    return actor.client.call(
      com.atproto.space.putRecord,
      {
        space,
        repo: actor.did,
        collection,
        rkey: (opts.rkey ?? 'self') as RecordKeyString,
        record: opts.record ?? record(collection, opts.text),
        validate: opts.validate,
      },
      { headers: opts.headers ?? actor.headers },
    )
  }

  async del(
    actor: Actor,
    space: SpaceRefString,
    opts: {
      collection?: NsidString
      rkey: string
      headers?: { authorization: string }
    },
  ) {
    return actor.client.call(
      com.atproto.space.deleteRecord,
      {
        space,
        repo: actor.did,
        collection: opts.collection ?? TEST_COLLECTION,
        rkey: opts.rkey as RecordKeyString,
      },
      { headers: opts.headers ?? actor.headers },
    )
  }

  /**
   * Issue a fresh space credential for `actor`: mint a delegation token on their
   * own PDS, then exchange it with the authority. Two hops, because a repo host
   * has no member list of its own — only the authority can decide who may read.
   */
  async credentialFor(
    actor: Actor,
    space: SpaceRefString,
    opts: { clientAttestation?: string; key?: JoseKey } = {},
  ): Promise<SpaceCredential> {
    const key = opts.key ?? (await JoseKey.generate(['ES256']))
    const token = await this.delegationTokenFor(actor, space)
    const res = await this.authority.getClient().call(
      com.atproto.space.getSpaceCredential,
      {
        space,
        dpopJkt: await dpopJktForKey(key),
        clientAttestation: opts.clientAttestation,
      },
      { headers: { authorization: `Bearer ${token}` } },
    )
    return new SpaceCredential(res.credential, key)
  }

  async delegationTokenFor(
    actor: Actor,
    space: SpaceRefString,
  ): Promise<string> {
    const res = await actor.client.call(
      com.atproto.space.getDelegationToken,
      { space },
      { headers: actor.headers },
    )
    return res.token
  }

  /**
   * Hand-mint a credential the authority would never issue. Its proof is valid, so a
   * rejection comes from what the test set out to exercise, not a missing proof.
   */
  async forgedCredential(
    sign: (dpopJkt: string) => Promise<string>,
  ): Promise<SpaceCredential> {
    const key = await JoseKey.generate(['ES256'])
    return new SpaceCredential(await sign(await dpopJktForKey(key)), key)
  }

  /** The exchange on its own, for tests about minting rather than about reading. */
  async mintCredential(
    space: SpaceRefString,
    token: string,
    opts: { clientAttestation?: string } = {},
  ) {
    const key = await JoseKey.generate(['ES256'])
    return this.authority.getClient().call(
      com.atproto.space.getSpaceCredential,
      {
        space,
        dpopJkt: await dpopJktForKey(key),
        clientAttestation: opts.clientAttestation,
      },
      { headers: { authorization: `Bearer ${token}` } },
    )
  }

  /** Read a repo's state directly. No endpoint exposes the raw set hash. */
  async repoState(actor: Actor, space: SpaceRefString) {
    return actor.pds.ctx.actorStore.read(actor.did, (store) =>
      store.space.getRepoState(space),
    )
  }

  /**
   * Assert a repo's stored set hash still equals one recomputed from its records.
   * Divergence here is silent and permanent, so it's worth asserting directly —
   * and there is no protocol surface that would reveal it.
   */
  async expectSetHashMatchesStore(actor: Actor, space: SpaceRefString) {
    const { records, state } = await actor.pds.ctx.actorStore.read(
      actor.did,
      async (store) => ({
        records: await store.space.listRecords(space, { limit: 1000 }),
        state: await store.space.getRepoState(space),
      }),
    )
    const recomputed = RepoCommit.fromRecords(
      records.map((r) => ({
        collection: r.collection,
        rkey: r.rkey,
        cid: parseCid(r.cid),
      })),
    )
    expect(
      recomputed.setHash.equals(RepoCommit.fromState(state?.setHash).setHash),
    ).toBe(true)
  }

  /**
   * The writer set as stored by the authority.
   *
   * Reads through storage rather than `listRepos` because the callers that need it
   * are polling for a best-effort notification to land, and `listRepos` needs a
   * credential minted per call. Use {@link expectWriterSet} to assert the
   * published view.
   */
  async writerDids(space: SpaceRefString): Promise<string[]> {
    const { spaceDid } = SpaceRef.parse(space)
    const writers = await this.authority.ctx.actorStore.read(
      spaceDid,
      (store) => store.space.listWriters(space, { limit: 100 }),
    )
    return writers.map((w) => w.did)
  }

  /**
   * The writer set, as `listRepos` publishes it. A repo missing from it is a repo
   * no syncer can discover, so it has to follow the same admission decision that
   * mints credentials rather than the member list — which they diverge from under
   * every policy but member-list.
   */
  async expectWriterSet(
    space: SpaceRefString,
    reader: Actor,
    expected: Actor[],
  ) {
    const cred = await this.credentialFor(reader, space)
    const res = await cred
      .clientFor(this.authority)
      .call(com.atproto.space.listRepos, { space })
    expect(res.repos.map((r) => r.did).sort()).toEqual(
      expected.map((a) => a.did).sort(),
    )
  }

  /**
   * Wait for a condition that a best-effort notification drives.
   *
   * `notifyWrite` is fired from the writer's PDS without awaiting, so there is no
   * queue on the writer side to drain — polling is the only option. Prefer
   * `network.pds.ctx.backgroundQueue.processAll()` where the work *is* queued
   * (the authority's outbound fan-out, `notifySpaceDeleted`).
   */
  async awaitNotify<T>(
    poll: () => Promise<T>,
    until: (value: T) => boolean,
    opts: { attempts?: number; delayMs?: number } = {},
  ): Promise<T> {
    const { attempts = 50, delayMs = 50 } = opts
    let last = await poll()
    for (let i = 0; i < attempts && !until(last); i++) {
      await new Promise((r) => setTimeout(r, delayMs))
      last = await poll()
    }
    return last
  }

  /** Whether a blob's bytes are still held for `actor`. */
  async blobExists(actor: Actor, cid: string): Promise<boolean> {
    const row = await actor.pds.ctx.actorStore.read(actor.did, (store) =>
      store.repo.blob.db.db
        .selectFrom('blob')
        .select('cid')
        .where('cid', '=', cid)
        .executeTakeFirst(),
    )
    return !!row
  }
}

/**
 * A space credential together with the key it is bound to. Mints a proof per request,
 * so it can't be reduced to a reusable header bag the way an access token can.
 *
 * The credential carries no holder identity — the requesting user's DID is spent at
 * mint time and is not in the token. Name these clients for the role (`asSyncer`),
 * never for the user, or a test reads as an identity assertion this path can't make.
 */
export class SpaceCredential {
  constructor(
    public credential: string,
    public key: JoseKey,
  ) {}

  clientFor(pds: TestPds): Client {
    const client = new Client({ service: pds.url, fetch: this.fetch })
    client.setLabelers([EXAMPLE_LABELER])
    return client
  }

  /** For requests made outside the client, e.g. a raw `getRepo` CAR download. */
  fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init)
    request.headers.set('authorization', `DPoP ${this.credential}`)
    request.headers.set(
      'dpop',
      await createDpopProof(this.key, {
        htm: request.method,
        htu: request.url,
        credential: this.credential,
      }),
    )
    return globalThis.fetch(request)
  }
}

/** A minimal record body for a test collection. */
export const record = (collection: NsidString, text = 'hello') => ({
  $type: collection,
  text,
  createdAt: new Date().toISOString(),
})

/**
 * A local HTTP service with a real PLC-registered DID, so the PDS resolves and
 * reaches it the way it would a managing app or a syncing service.
 *
 * Records every request it receives, which is how a test observes a fan-out that
 * is otherwise fire-and-forget.
 */
export class MockService {
  public calls: { lxm: string; body: unknown; auth?: string }[] = []
  private terminator: HttpTerminator

  private constructor(
    server: Server,
    public url: string,
    public did: DidString,
    public serviceId: string,
    private responder: () => { status: number; body: unknown },
  ) {
    this.terminator = createHttpTerminator({ server })
  }

  /** `did#serviceId`, the form a notify target is registered under. */
  get serviceRef(): string {
    return `${this.did}#${this.serviceId}`
  }

  callsTo(lxm: string) {
    return this.calls.filter((c) => c.lxm === lxm)
  }

  static async create(
    network: TestNetworkNoAppView,
    opts: {
      serviceId: string
      /** Defaults to 200 with an empty object. */
      respond?: () => { status: number; body: unknown }
    },
  ): Promise<MockService> {
    const respond = opts.respond ?? (() => ({ status: 200, body: {} }))
    const calls: MockService['calls'] = []

    const server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        const url = new URL(req.url ?? '/', 'http://localhost')
        calls.push({
          // `/xrpc/<lxm>`
          lxm: url.pathname.replace(/^\/xrpc\//, ''),
          body: raw
            ? safeJson(raw)
            : Object.fromEntries(url.searchParams.entries()),
          auth: req.headers['authorization'] as string | undefined,
        })
        const { status, body } = respond()
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      })
    })
    server.listen(0)
    await once(server, 'listening')
    const url = `http://localhost:${(server.address() as AddressInfo).port}`

    // A real PLC identity, so the PDS's own resolver finds the endpoint.
    const keypair = await Secp256k1Keypair.create()
    const plcOp = await plc.signOperation(
      {
        type: 'plc_operation',
        rotationKeys: [keypair.did()],
        alsoKnownAs: [],
        verificationMethods: {},
        services: {
          [opts.serviceId]: { type: 'AtprotoSpaceService', endpoint: url },
        },
        prev: null,
      },
      keypair,
    )
    const did = await plc.didForCreateOp(plcOp)
    await network.pds.ctx.plcClient.sendOperation(did, plcOp)

    const service = new MockService(
      server,
      url,
      did as DidString,
      opts.serviceId,
      respond,
    )
    service.calls = calls
    return service
  }

  close(): Promise<void> {
    return this.terminator.terminate()
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close()
  }
}

const safeJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/**
 * A stand-in OAuth client that publishes real `client-metadata.json` and JWKS
 * documents over HTTP, so `ClientAttestationVerifier` resolves and checks a
 * signature against a key it actually fetched.
 *
 * Needed because the production verifier is built with an SSRF-guarded fetch that
 * won't reach a test server by hostname; {@link installOn} swaps in a verifier
 * bound to plain fetch for the duration of a test.
 */
export class MockClientApp {
  private terminator: HttpTerminator

  private constructor(
    server: Server,
    public clientId: string,
    public jwksUri: string,
    public key: JoseKey,
  ) {
    this.terminator = createHttpTerminator({ server })
  }

  static async create(
    opts: { kid?: string; publishKeys?: boolean } = {},
  ): Promise<MockClientApp> {
    const key = await JoseKey.generate(['ES256'], opts.kid ?? 'key-1')

    let base = ''
    const server = createServer((req, res) => {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname
      const send = (body: unknown) => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      if (path === '/client-metadata.json') {
        return send({
          client_id: `${base}/client-metadata.json`,
          client_name: 'Mock Space App',
          redirect_uris: [`${base}/cb`],
          response_types: ['code'],
          grant_types: ['authorization_code'],
          scope: 'atproto',
          application_type: 'web',
          token_endpoint_auth_method: 'private_key_jwt',
          dpop_bound_access_tokens: true,
          ...(opts.publishKeys === false
            ? {}
            : { jwks_uri: `${base}/jwks.json` }),
        })
      }
      if (path === '/jwks.json') {
        return send({ keys: [key.publicJwk] })
      }
      res.writeHead(404).end()
    })
    server.listen(0)
    await once(server, 'listening')
    // A loopback IP, not `localhost`: RFC 8252 forbids the hostname in
    // `redirect_uris`, and the client metadata schema enforces that.
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

    return new MockClientApp(
      server,
      `${base}/client-metadata.json`,
      `${base}/jwks.json`,
      key,
    )
  }

  /**
   * Point a PDS's attestation verifier at a fetch that can reach this server,
   * restoring the original on dispose.
   */
  installOn(pds: TestPds): { [Symbol.dispose]: () => void } {
    const original = pds.ctx.clientAttestationVerifier
    // dev-env exports AppContext from its built dist/, while we construct the
    // verifier from src/ — two identical shapes with separate declarations. Cast
    // at that boundary only; the behaviour under test is the real thing.
    const replacement = new ClientAttestationVerifier(((input: Request) =>
      globalThis.fetch(input)) as never) as unknown as typeof original
    pds.ctx.clientAttestationVerifier = replacement
    return {
      [Symbol.dispose]: () => {
        pds.ctx.clientAttestationVerifier = original
      },
    }
  }

  /** An attestation for `spaceHost`, signed by this app's own key by default. */
  async attest(
    spaceHost: string,
    opts: { signWith?: JoseKey; iss?: string; expiresInSec?: number } = {},
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const signer = opts.signWith ?? this.key
    return signer.createJwt(
      { alg: 'ES256', typ: 'atproto-client-attestation+jwt' },
      {
        iss: opts.iss ?? this.clientId,
        sub: opts.iss ?? this.clientId,
        aud: spaceHost,
        iat: now,
        exp: now + (opts.expiresInSec ?? 60),
        jti: `nonce-${now}`,
      },
    )
  }

  close(): Promise<void> {
    return this.terminator.terminate()
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close()
  }
}

/**
 * A record-key-safe slug of the running test's name, so a space doesn't have to
 * be named separately from the test that owns it.
 *
 * Jest reports the name as the describe/it path joined by spaces, e.g.
 * "space records writes a record as a co-located member".
 */
function currentTestSkey(): string {
  const slug = (expect.getState().currentTestName ?? 'space')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Record keys cap at 512 chars; leave room and stay readable.
    .slice(0, 120)
  return slug || 'space'
}
