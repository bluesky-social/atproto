import { once } from 'node:events'
import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as plc from '@did-plc/lib'
import { jest } from '@jest/globals'
import { type HttpTerminator, createHttpTerminator } from 'http-terminator'
import { TID, getVerificationMaterial } from '@atproto/common'
import { P256Keypair, Secp256k1Keypair } from '@atproto/crypto'
import {
  EXAMPLE_LABELER,
  SeedClient,
  TestNetworkNoAppView,
  type TestPds,
} from '@atproto/dev-env'
import type { IdResolver } from '@atproto/identity'
import { Client, type DidString } from '@atproto/lex'
import { type LexMap, parseCid } from '@atproto/lex-data'
import { JoseKey } from '@atproto/oauth-provider/provider'
import { ReplayManager } from '@atproto/oauth-provider/verifier'
import {
  COMMIT_MAC_PROFILE,
  type MacProfile,
  RECORD_MAC_PROFILE,
  RepoCommit,
  type SpaceCommit,
  type VerifyMacParams,
  buildClientAttestation,
  createSpaceSigHeaders,
  encapsulate,
  formatMacRequest,
  verifyCommit,
} from '@atproto/space'
import {
  type HandleString,
  type NsidString,
  type RecordKeyString,
  SpaceRef,
  type SpaceRefString,
  type UriString,
} from '@atproto/syntax'
import { ClientAttestationVerifier } from '../src/client-attestation-verifier.js'
import { com } from '../src/lexicons/index.js'

// The methods whose responses a repo host authenticates with a MAC.
const MAC_PROFILE_BY_METHOD: Record<string, MacProfile> = {
  [com.atproto.space.getLatestCommit.$lxm]: COMMIT_MAC_PROFILE,
  [com.atproto.space.getRepo.$lxm]: COMMIT_MAC_PROFILE,
  [com.atproto.space.listRepoOps.$lxm]: COMMIT_MAC_PROFILE,
  [com.atproto.space.getRecord.$lxm]: RECORD_MAC_PROFILE,
}

// Collections outside the PDS's built-in schemas, so records validate as `unknown`.
export const TEST_COLLECTION = 'com.example.spaceRecord' as NsidString
export const TEST_COLLECTION_ALT = 'com.example.spaceNote' as NsidString

// Published as a `space` lexicon by the dev-env lexicon authority.
export const TEST_SPACE_TYPE = 'com.example.group' as NsidString

/** An account, with everything needed to act as it. */
export type Actor = {
  name: string
  did: DidString
  password: string
  headers: { authorization: string }
  pds: TestPds
  client: Client
}

export type AccountStatus = 'takendown' | 'deactivated'

type SpaceOptions = {
  skey?: string
  spaceType?: NsidString
  members?: Actor[]
  /** Defaults to a memberspace policy with its default configuration. */
  policy?: com.atproto.space.createSpace.$InputBody['policy']
  /** Skip createSpace, naming a space no host governs. */
  ungoverned?: boolean
}

type WriteOptions = {
  collection?: NsidString
  rkey?: string
  text?: string
  record?: LexMap
  validate?: boolean
  /** Authenticate as something other than the actor's own session. */
  headers?: { authorization: string }
}

type AuthorizeOptions = {
  delegationToken?: string
  clientAttestation?: string
  notify?: com.atproto.space.authorizeSpaceSync.Notify
  key?: P256Keypair
}

/**
 * Three PDSes and four accounts: alice (the space authority) and dan on pds1,
 * bob on pds2, carol on pds3.
 */
export async function createSpaceNetwork(
  opts: { lexiconAuthority?: boolean } = {},
) {
  const network = await TestNetworkNoAppView.create({
    extraPdses: 2,
    lexiconAuthority: opts.lexiconAuthority,
  })
  const sc = new SpaceClient(network)
  const [pds2, pds3] = network.extraPdses
  return {
    network,
    sc,
    alice: await sc.createActor('alice'),
    dan: await sc.createActor('dan'),
    bob: await sc.createActor('bob', pds2),
    carol: await sc.createActor('carol', pds3),
  }
}

/** Test helper for permissioned spaces, in the spirit of `SeedClient`. */
export class SpaceClient {
  constructor(public network: TestNetworkNoAppView) {}

  /** The PDS hosting every space authority in these tests. */
  get authority(): TestPds {
    return this.network.pds
  }

  get idResolver(): IdResolver {
    return this.authority.ctx.idResolver
  }

  async createActor(name: string, pds = this.network.pds): Promise<Actor> {
    const [domain] = pds.ctx.cfg.identity.serviceHandleDomains
    const password = `${name}-pass`
    const client = pds.getClient()
    const { did, accessJwt } = await client.call(
      com.atproto.server.createAccount,
      {
        handle: `${name}${domain}` as HandleString,
        email: `${name}@test.com`,
        password,
      },
    )
    return {
      name,
      did,
      password,
      headers: SeedClient.getHeaders(accessJwt),
      pds,
      client,
    }
  }

  /** Put `actor` in `status` until disposed, through the admin and account APIs. */
  async withStatus(
    actor: Actor,
    status: AccountStatus,
  ): Promise<AsyncDisposable> {
    if (status === 'deactivated') {
      await actor.client.call(
        com.atproto.server.deactivateAccount,
        {},
        { headers: actor.headers },
      )
      return {
        [Symbol.asyncDispose]: async () => {
          await actor.client.xrpc(com.atproto.server.activateAccount, {
            headers: actor.headers,
          })
        },
      }
    }

    const takedown = (applied: boolean) =>
      actor.client.call(
        com.atproto.admin.updateSubjectStatus,
        {
          subject: com.atproto.admin.defs.repoRef.$build({ did: actor.did }),
          takedown: { applied },
        },
        { headers: actor.pds.adminAuthHeaders() },
      )
    await takedown(true)
    return {
      [Symbol.asyncDispose]: async () => {
        await takedown(false)
      },
    }
  }

  /** Create a space anchored on `authority`'s DID, keyed by a fresh TID by default. */
  async createSpace(
    authority: Actor,
    opts: SpaceOptions = {},
  ): Promise<SpaceRefString> {
    const spaceType = opts.spaceType ?? TEST_SPACE_TYPE
    const skey = (opts.skey ?? TID.nextStr()) as RecordKeyString
    if (opts.ungoverned) {
      return new SpaceRef(authority.did, spaceType, skey).toString()
    }
    const { space } = await authority.client.call(
      com.atproto.space.createSpace,
      {
        spaceType,
        skey,
        policy: opts.policy ?? com.atproto.memberspace.policy.$build({}),
      },
      { headers: authority.headers },
    )
    for (const member of opts.members ?? []) {
      await this.putMember(authority, space, member)
    }
    return space
  }

  async putMember(
    authority: Actor,
    space: SpaceRefString,
    member: Actor,
    access: { read: boolean; write: boolean } = { read: true, write: true },
  ) {
    return authority.client.call(
      com.atproto.memberspace.putMembers,
      { space, members: [{ did: member.did, ...access }] },
      { headers: authority.headers },
    )
  }

  async removeMember(authority: Actor, space: SpaceRefString, member: Actor) {
    return authority.client.call(
      com.atproto.memberspace.removeMembers,
      { space, dids: [member.did] },
      { headers: authority.headers },
    )
  }

  async removeWriter(authority: Actor, space: SpaceRefString, writer: Actor) {
    return authority.client.call(
      com.atproto.space.removeWriter,
      { space, repo: writer.did },
      { headers: authority.headers },
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

  async clear(
    actor: Actor,
    space: SpaceRefString,
    opts: { headers?: { authorization: string } } = {},
  ) {
    return actor.client.call(
      com.atproto.space.clearRecords,
      { space, repo: actor.did },
      { headers: opts.headers ?? actor.headers },
    )
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

  /** Ask the authority for a space credential; with no delegation token, as for a public space. */
  async authorize(
    space: SpaceRefString,
    opts: AuthorizeOptions = {},
  ): Promise<SpaceCredential> {
    const key = opts.key ?? (await P256Keypair.create())
    const res = await this.authority
      .getClient()
      .call(com.atproto.space.authorizeSpaceSync, {
        space,
        credentialKey: key.did(),
        delegationToken: opts.delegationToken,
        clientAttestation: opts.clientAttestation,
        notify: opts.notify,
      })
    return new SpaceCredential(
      res.credential,
      key,
      this.idResolver,
      res.spaceRev,
    )
  }

  /** Exchange a delegation token minted on `actor`'s own PDS for a space credential. */
  async credentialFor(
    actor: Actor,
    space: SpaceRefString,
    opts: Omit<AuthorizeOptions, 'delegationToken'> = {},
  ): Promise<SpaceCredential> {
    const delegationToken = await this.delegationTokenFor(actor, space)
    return this.authorize(space, { ...opts, delegationToken })
  }

  /** The latest commit of `actor`'s repo, read with its own session; null if unwritten. */
  async latestCommit(
    actor: Actor,
    space: SpaceRefString,
  ): Promise<SpaceCommit | null> {
    const res = await actor.client.xrpcSafe(com.atproto.space.getLatestCommit, {
      params: { space, repo: actor.did },
      headers: actor.headers,
    })
    if (res.success) return res.body.commit
    if (res.error === 'RepoNotFound') return null
    throw res
  }

  /** Assert `actor`'s latest commit covers exactly the records its repo lists. */
  async expectCommitMatchesRecords(actor: Actor, space: SpaceRefString) {
    const { records } = await actor.client.call(
      com.atproto.space.listRecords,
      { space, repo: actor.did, limit: 1000, excludeValues: true },
      { headers: actor.headers },
    )
    const commit = await this.latestCommit(actor, space)
    const fromRecords = RepoCommit.fromRecords(
      records.map((r) => ({ ...r, cid: parseCid(r.cid) })),
    )
    expect(commit && fromRecords.matches(commit)).toBe(true)
  }

  /** The writer set of `space`, as listWriters publishes it to `reader`. */
  async writers(space: SpaceRefString, reader: Actor): Promise<DidString[]> {
    const cred = await this.credentialFor(reader, space)
    const { repos } = await cred
      .clientFor(this.authority)
      .call(com.atproto.space.listWriters, { space, limit: 100 })
    return repos
      .filter((r) => com.atproto.space.defs.repoWrite.$isTypeOf(r))
      .map((r) => r.repo)
      .sort()
  }

  /** Make every notification retry queued on `pds` due, and run them. */
  async retryNotifications(pds: TestPds): Promise<void> {
    const { db } = pds.ctx.accountManager.db
    await db
      .updateTable('space_notification_retry')
      .set({ retryAt: 0 })
      .execute()
    await db
      .updateTable('space_syncer_notification_retry')
      .set({ retryAt: 0 })
      .execute()
    await pds.ctx.spaceNotifications.retryPending()
  }

  /** Expire a notify registration, as if it had not been renewed. No endpoint does this. */
  async lapseRegistration(
    space: SpaceRefString,
    endpoint: string,
  ): Promise<void> {
    const { spaceDid } = SpaceRef.parse(space)
    await this.authority.ctx.actorStore.transact(spaceDid, (txn) =>
      txn.space.db.db
        .updateTable('space_notify_registration')
        .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
        .where('space', '=', space)
        .where('endpoint', '=', endpoint)
        .execute(),
    )
  }

  /**
   * Accept a DPoP-scheme request on `actor`'s PDS as an OAuth token carrying
   * `scope`, until disposed. Everything past token verification is real.
   */
  asOAuth(actor: Actor, scope: string) {
    const verifier = actor.pds.ctx.authVerifier.oauthVerifier
    const spy = jest
      .spyOn(verifier, 'authenticateRequest')
      .mockResolvedValue({ sub: actor.did, scope } as Awaited<
        ReturnType<typeof verifier.authenticateRequest>
      >)
    return {
      client: actor.client,
      headers: { authorization: 'DPoP test-oauth-token' },
      [Symbol.dispose]: () => spy.mockRestore(),
    }
  }

  /** Whether a blob's bytes are still held for `actor`. No endpoint exposes this. */
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
 * A space credential and its key, acting as a syncer: signs each request for the
 * repo it reads, and requests a MAC from the methods that return one.
 */
export class SpaceCredential {
  /** The encapsulation and response headers of the latest MAC'd request. */
  lastMac?: VerifyMacParams & { profile: MacProfile }

  constructor(
    public credential: string,
    public key: P256Keypair,
    public idResolver: IdResolver,
    public spaceRev?: string,
  ) {}

  clientFor(pds: TestPds): Client {
    const client = new Client({ service: pds.url, fetch: this.fetch })
    client.setLabelers([EXAMPLE_LABELER])
    return client
  }

  /** Headers presenting this credential to `audience`, for requests made by hand. */
  async signedHeaders(
    audience: DidString,
    opts: { scheme?: string } = {},
  ): Promise<Record<string, string>> {
    const scheme = opts.scheme ?? 'Atproto-Space-Credential'
    const { headers } = await createSpaceSigHeaders({
      authorization: `${scheme} ${this.credential}`,
      audience,
      keypair: this.key,
    })
    return headers
  }

  fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init)
    const params =
      request.method === 'GET'
        ? Object.fromEntries(new URL(request.url).searchParams)
        : await request.clone().json()
    const audience = params.repo ?? SpaceRef.parse(params.space).spaceDid
    for (const [name, value] of Object.entries(
      await this.signedHeaders(audience),
    )) {
      request.headers.set(name, value)
    }

    const lxm = new URL(request.url).pathname.replace(/^\/xrpc\//, '')
    const profile = MAC_PROFILE_BY_METHOD[lxm]
    if (!profile || request.headers.has('accept-signature')) {
      return globalThis.fetch(request)
    }
    const encapsulation = await encapsulate(
      await this.resolveKemKey(params.repo),
    )
    request.headers.set(
      'accept-signature',
      formatMacRequest(profile, encapsulation.keyShare),
    )
    const response = await globalThis.fetch(request)
    this.lastMac = { ...encapsulation, headers: response.headers, profile }
    return response
  }

  async resolveKemKey(did: string): Promise<DidString> {
    const didDoc = await this.idResolver.did.ensureResolve(did)
    const kemKey = getVerificationMaterial(didDoc, 'atproto_kem')
    if (!kemKey) throw new Error(`no #atproto_kem key for ${did}`)
    return `did:key:${kemKey.publicKeyMultibase}`
  }

  lastMacParams(): VerifyMacParams {
    if (!this.lastMac) throw new Error('no MAC was requested')
    return this.lastMac
  }

  /** Verify a commit against the MAC from the latest request. */
  verifyCommit(
    commit: SpaceCommit,
    requested: { space: SpaceRefString; repo: DidString },
  ): void {
    verifyCommit(commit, { ...requested, ...this.lastMacParams() })
  }
}

/** A minimal record body for a test collection. */
export const record = (collection: NsidString, text = 'hello') => ({
  $type: collection,
  text,
  createdAt: new Date().toISOString(),
})

type MockCall = { lxm: string; body: unknown; auth?: string }
type MockResponse = { status: number; body: unknown }

/**
 * A local XRPC service with a PLC DID, standing in for a managing app, a space
 * host, or a syncer. Records every request it receives.
 */
export class MockService {
  public calls: MockCall[] = []
  private terminator: HttpTerminator

  private constructor(
    server: Server,
    public url: string,
    public did: DidString,
    public serviceId: string,
  ) {
    this.terminator = createHttpTerminator({ server })
  }

  /** `did#serviceId`, the form a managing app is named by. */
  get serviceRef(): string {
    return `${this.did}#${this.serviceId}`
  }

  /** An authorizeSpaceSync `notify` registration for this service. */
  notifyRegistration(
    token = 'notify-token',
  ): com.atproto.space.authorizeSpaceSync.Notify {
    return { endpoint: this.url as UriString, token }
  }

  callsTo(lxm: string) {
    return this.calls.filter((c) => c.lxm === lxm)
  }

  /** The `update` of each notifySpaceUpdate call, in the order received. */
  spaceUpdates() {
    return this.callsTo(com.atproto.space.notifySpaceUpdate.$lxm).map(
      (call) =>
        (call.body as com.atproto.space.notifySpaceUpdate.$InputBody).update,
    )
  }

  static async create(
    network: TestNetworkNoAppView,
    opts: {
      serviceId: string
      /** Defaults to 200 with an empty object. */
      respond?: (call: MockCall) => MockResponse | Promise<MockResponse>
      /** Whether to confirm notify registrations by echoing the challenge. Defaults to true. */
      confirmRegistrations?: boolean
    },
  ): Promise<MockService> {
    const respond = opts.respond ?? (() => ({ status: 200, body: {} }))
    const confirmRegistrations = opts.confirmRegistrations ?? true
    const calls: MockCall[] = []

    const server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', async () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        const url = new URL(req.url ?? '/', 'http://localhost')
        const call: MockCall = {
          lxm: url.pathname.replace(/^\/xrpc\//, ''),
          body: raw
            ? safeJson(raw)
            : Object.fromEntries(url.searchParams.entries()),
          auth: req.headers['authorization'],
        }
        calls.push(call)
        const { status, body } =
          confirmRegistrations &&
          call.lxm === com.atproto.space.confirmRegistration.$lxm
            ? { status: 200, body: { challenge: (call.body as any).challenge } }
            : await respond(call)
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      })
    })
    server.listen(0)
    await once(server, 'listening')
    const url = `http://localhost:${(server.address() as AddressInfo).port}`

    const keypair = await Secp256k1Keypair.create()
    const plcOp = await plc.signOperation(
      {
        type: 'plc_operation',
        rotationKeys: [keypair.did()],
        alsoKnownAs: [],
        verificationMethods: { atproto: keypair.did() },
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
 * An OAuth client publishing real `client-metadata.json` and JWKS documents, so
 * the PDS verifies an attestation against a key it actually fetched.
 */
export class MockClientApp {
  private terminator: HttpTerminator

  private constructor(
    server: Server,
    public clientId: UriString,
    public key: JoseKey,
  ) {
    this.terminator = createHttpTerminator({ server })
  }

  static async create(): Promise<MockClientApp> {
    const key = await JoseKey.generate(['ES256'], 'key-1')

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
          jwks_uri: `${base}/jwks.json`,
        })
      }
      if (path === '/jwks.json') {
        return send({ keys: [key.publicJwk] })
      }
      res.writeHead(404).end()
    })
    server.listen(0)
    await once(server, 'listening')
    // A loopback IP: client metadata may not name `localhost` in redirect_uris.
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

    return new MockClientApp(
      server,
      `${base}/client-metadata.json` as UriString,
      key,
    )
  }

  /**
   * Swap in an attestation verifier that can reach this server (the PDS's own
   * fetch is SSRF-guarded), restoring the original on dispose.
   */
  installOn(pds: TestPds): Disposable {
    const original = pds.ctx.clientAttestationVerifier
    const seen = new Set<string>()
    // dev-env's AppContext type comes from the built PDS, this verifier from src.
    pds.ctx.clientAttestationVerifier = new ClientAttestationVerifier(
      ((input: Request) => globalThis.fetch(input)) as never,
      new ReplayManager({
        unique: (namespace, nonce) => {
          const key = `${namespace}:${nonce}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        },
      }),
    ) as unknown as typeof original
    return {
      [Symbol.dispose]: () => {
        pds.ctx.clientAttestationVerifier = original
      },
    }
  }

  /** An attestation for `spaceHost`, signed by this app's own key by default. */
  async attest(
    spaceHost: string,
    opts: { signWith?: JoseKey; expiresInSec?: number } = {},
  ): Promise<string> {
    const { header, payload } = buildClientAttestation({
      clientId: this.clientId,
      aud: spaceHost,
      expiresInSec: opts.expiresInSec,
    })
    return (opts.signWith ?? this.key).createJwt(
      { alg: 'ES256', ...header },
      payload,
    )
  }

  close(): Promise<void> {
    return this.terminator.terminate()
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close()
  }
}
