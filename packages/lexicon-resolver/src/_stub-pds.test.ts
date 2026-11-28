import { type Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { type DidDocument, DidResolver, IdResolver } from '@atproto/identity'
import type { Cid, LexMap } from '@atproto/lex-data'
import type { DidString, NsidString } from '@atproto/lex-schema'
import { LexRouter, LexServerError } from '@atproto/lex-server'
import {
  MemoryBlockstore,
  Repo,
  WriteOpAction,
  cidForRecord,
  concatBytesAsync,
  getRecords,
} from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { com } from './lexicons/index.js'

const PDS_URL = 'https://pds.example.com'

/** DID document contents, shaped like a `did:plc` operation. */
export type IdentityData = {
  alsoKnownAs: string[]
  /** Key ids to `did:key` public keys */
  verificationMethods: Record<string, string>
  services: Record<string, { type: string; endpoint: string }>
}

export type StubAccount = {
  did: DidString
  keypair: Keypair
  storage: MemoryBlockstore
  repo: Repo
}

/**
 * Stands in for a PDS and the DID directory: serves
 * `com.atproto.sync.getRecord` proofs from in-memory repos signed with keys it
 * controls, and resolves its accounts' DID documents without network access.
 */
export class StubPds {
  readonly idResolver = new IdResolver()

  private readonly accounts = new Map<string, StubAccount>()
  private readonly identities = new Map<string, IdentityData>()

  private readonly router = new LexRouter().add(
    com.atproto.sync.getRecord,
    async ({ params: { did, collection, rkey } }) => {
      const account = this.accounts.get(did)
      if (!account) {
        throw new LexServerError(400, {
          error: 'RepoNotFound',
          message: `Could not find repo for DID: ${did}`,
        })
      }
      // @NOTE like a PDS, proves non-existence of a missing record
      const car = getRecords(account.storage, account.repo.cid, [
        { collection, rkey },
      ])
      return {
        encoding: 'application/vnd.ipld.car' as const,
        body: new Uint8Array(await concatBytesAsync(car)),
      }
    },
  )

  constructor() {
    this.idResolver.did = new MemoryDidResolver(this.identities)
  }

  /** `fetch` for the resolver: only reaches this PDS, without a socket. */
  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    if (new URL(request.url).origin !== PDS_URL) {
      throw new TypeError(`fetch failed: unknown host for ${request.url}`)
    }
    return this.router.fetch(request)
  }

  async createAccount(name: string): Promise<StubAccount> {
    const did: DidString = `did:example:${name}`
    const keypair = await Secp256k1Keypair.create()
    const storage = new MemoryBlockstore()
    const repo = await Repo.create(storage, did, keypair)
    const account = { did, keypair, storage, repo }
    this.accounts.set(did, account)
    this.identities.set(did, {
      alsoKnownAs: [`at://${name}.test`],
      verificationMethods: { atproto: keypair.did() },
      services: {
        atproto_pds: { type: 'AtprotoPersonalDataServer', endpoint: PDS_URL },
      },
    })
    return account
  }

  async createRecord(
    account: StubAccount,
    collection: NsidString,
    rkey: string,
    record: LexMap,
  ): Promise<{ uri: AtUri; cid: Cid }> {
    account.repo = await account.repo.applyWrites(
      { action: WriteOpAction.Create, collection, rkey, record },
      account.keypair,
    )
    return {
      uri: AtUri.make(account.did, collection, rkey),
      cid: await cidForRecord(record),
    }
  }

  /** Publishes a new DID document, as a `did:plc` update would. */
  updateIdentity(did: DidString, update: (data: IdentityData) => IdentityData) {
    const data = this.identities.get(did)
    if (!data) throw new Error(`Unknown DID: ${did}`)
    this.identities.set(did, update(structuredClone(data)))
  }
}

class MemoryDidResolver extends DidResolver {
  constructor(private readonly identities: Map<string, IdentityData>) {
    super({})
  }

  override async resolveNoCheck(did: string): Promise<DidDocument | null> {
    const data = this.identities.get(did)
    return data ? formatDidDocument(did, data) : null
  }
}

function formatDidDocument(did: string, data: IdentityData): DidDocument {
  return {
    id: did,
    alsoKnownAs: data.alsoKnownAs,
    verificationMethod: Object.entries(data.verificationMethods).map(
      ([id, didKey]) => ({
        id: `${did}#${id}`,
        type: 'Multikey',
        controller: did,
        publicKeyMultibase: didKey.slice('did:key:'.length),
      }),
    ),
    service: Object.entries(data.services).map(([id, { type, endpoint }]) => ({
      id: `#${id}`,
      type,
      serviceEndpoint: endpoint,
    })),
  }
}
