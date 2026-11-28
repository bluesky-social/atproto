import { EventEmitter, once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { assert } from 'vitest'
import { TID } from '@atproto/common'
import { type Keypair, Secp256k1Keypair, randomStr } from '@atproto/crypto'
import {
  type DidDocument,
  DidResolver,
  HandleResolver,
  IdResolver,
} from '@atproto/identity'
import type { Cid, LexMap } from '@atproto/lex-data'
import {
  type DatetimeString,
  type DidString,
  type HandleString,
  type NsidString,
  currentDatetimeString,
} from '@atproto/lex-schema'
import { LexRouter } from '@atproto/lex-server'
import {
  type Server,
  serve,
  upgradeWebSocket,
} from '@atproto/lex-server/nodejs'
import {
  BlockMap,
  MemoryBlockstore,
  Repo,
  WriteOpAction,
  blocksToCarFile,
  cidForRecord,
  formatDataKey,
} from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { com } from '../lexicons/index.js'

const { subscribeRepos } = com.atproto.sync

const COLLECTION: NsidString = 'com.example.post'

export type TestAccount = {
  did: DidString
  handle: HandleString
  keypair: Keypair
  repo: Repo
}

export type TestPost = {
  uri: AtUri
  cid: Cid
  commit: Cid
  record: LexMap
}

/**
 * Stands in for a PDS: serves `com.atproto.sync.subscribeRepos` from an
 * in-memory event log fed by real signed repos, and resolves its accounts'
 * identities without network access.
 */
export class StubPds implements AsyncDisposable {
  readonly idResolver = new IdResolver()

  private readonly didDocs = new Map<string, DidDocument>()
  private readonly handles = new Map<string, DidString>()
  private readonly log: com.atproto.sync.subscribeRepos.$Message[] = []
  private readonly appended = new EventEmitter()

  private constructor(private readonly server: Server) {
    this.idResolver.did = new MemoryDidResolver(this.didDocs)
    this.idResolver.handle = new MemoryHandleResolver(this.handles)
  }

  static async create(): Promise<StubPds> {
    const router = new LexRouter({ upgradeWebSocket })
    const pds = new StubPds(await serve(router))
    router.add(subscribeRepos, ({ params, signal }) =>
      pds.subscribe(params.cursor, signal),
    )
    return pds
  }

  get url(): string {
    const { port } = this.server.address() as AddressInfo
    return `ws://localhost:${port}`
  }

  /** Sequence number of the last emitted event. */
  get seq(): number {
    return this.log.length
  }

  // Like a PDS: replays the events after `cursor` if one is given, then
  // streams new events as they are appended.
  private async *subscribe(cursor: number | undefined, signal: AbortSignal) {
    let next = cursor ?? this.log.length
    while (true) {
      while (next < this.log.length) yield this.log[next++]
      await once(this.appended, 'append', { signal })
    }
  }

  private append(
    build: (
      seq: number,
      time: DatetimeString,
    ) => com.atproto.sync.subscribeRepos.$Message,
  ) {
    this.log.push(build(this.log.length + 1, currentDatetimeString()))
    this.appended.emit('append')
  }

  /** Emits `#identity`, `#account` and `#sync` events, as account creation does. */
  async createAccount(name: string): Promise<TestAccount> {
    const keypair = await Secp256k1Keypair.create()
    const did: DidString = `did:plc:${randomStr(15, 'base32')}`
    const handle: HandleString = `${name}.test`
    this.didDocs.set(did, didDocument(did, handle, keypair))
    this.handles.set(handle, did)

    const storage = new MemoryBlockstore()
    const repo = await Repo.create(storage, did, keypair)
    const commitBlock = await storage.getBytes(repo.cid)
    assert(commitBlock)
    const blocks = await blocksToCarFile(
      repo.cid,
      new BlockMap([[repo.cid, commitBlock]]),
    )

    this.emitIdentity(did, handle)
    this.append((seq, time) =>
      subscribeRepos.account.$build({ seq, time, did, active: true }),
    )
    this.append((seq, time) =>
      subscribeRepos.sync.$build({
        seq,
        time,
        did,
        rev: repo.commit.rev,
        blocks,
      }),
    )

    return { did, handle, keypair, repo }
  }

  /**
   * Replaces the handle claimed by the account's DID document, without making
   * that handle resolve to the account.
   */
  updateDidDocument(
    account: TestAccount,
    { handle }: { handle: HandleString },
  ) {
    this.didDocs.set(
      account.did,
      didDocument(account.did, handle, account.keypair),
    )
  }

  emitIdentity(did: DidString, handle?: HandleString) {
    this.append((seq, time) =>
      subscribeRepos.identity.$build({ seq, time, did, handle }),
    )
  }

  /**
   * Creates a record in the account's repo and emits its `#commit` event. The
   * commit is signed with `signingKey`, the account's own key by default.
   */
  async post(
    account: TestAccount,
    text: string,
    { signingKey = account.keypair }: { signingKey?: Keypair } = {},
  ): Promise<TestPost> {
    const rkey = TID.nextStr()
    const record = {
      $type: COLLECTION,
      text,
      createdAt: currentDatetimeString(),
    }
    const prevData = account.repo.commit.data
    const commit = await account.repo.formatCommit(
      { action: WriteOpAction.Create, collection: COLLECTION, rkey, record },
      signingKey,
    )
    const cid = await cidForRecord(record)
    const blocks = await blocksToCarFile(
      commit.cid,
      new BlockMap().addMap(commit.newBlocks).addMap(commit.relevantBlocks),
    )
    account.repo = await account.repo.applyCommit(commit)

    this.append((seq, time) =>
      subscribeRepos.commit.$build({
        seq,
        time,
        repo: account.did,
        commit: commit.cid,
        rev: commit.rev,
        since: commit.since,
        blocks,
        ops: [{ action: 'create', path: formatDataKey(COLLECTION, rkey), cid }],
        prevData,
        blobs: [],
        rebase: false,
        tooBig: false,
      }),
    )

    return {
      uri: AtUri.make(account.did, COLLECTION, rkey),
      cid,
      commit: commit.cid,
      record,
    }
  }

  async [Symbol.asyncDispose]() {
    await this.server.terminate()
  }
}

class MemoryDidResolver extends DidResolver {
  constructor(private readonly docs: Map<string, DidDocument>) {
    super({})
  }

  override async resolveNoCheck(did: string): Promise<DidDocument | null> {
    return this.docs.get(did) ?? null
  }
}

class MemoryHandleResolver extends HandleResolver {
  constructor(private readonly dids: Map<string, DidString>) {
    super()
  }

  override async resolve(handle: string): Promise<string | undefined> {
    return this.dids.get(handle)
  }
}

function didDocument(
  did: DidString,
  handle: HandleString,
  keypair: Keypair,
): DidDocument {
  return {
    id: did,
    alsoKnownAs: [`at://${handle}`],
    verificationMethod: [
      {
        id: `${did}#atproto`,
        type: 'Multikey',
        controller: did,
        publicKeyMultibase: keypair.did().slice('did:key:'.length),
      },
    ],
    service: [
      {
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
        serviceEndpoint: 'https://pds.example.com',
      },
    ],
  }
}
