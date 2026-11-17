import { formatDidVerificationMethod } from '@atproto/crypto'
import { extractKemKey, extractPdsUrl } from '@atproto/did'
import { cidForLex } from '@atproto/lex-cbor'
import {
  type Agent,
  type CidString,
  type DidString,
  type Infer,
  type InferMethodOutputBody,
  type LexMap,
  type Main,
  type NsidString,
  type Procedure,
  type Query,
  XrpcAuthenticationError,
  type XrpcOptions,
  type XrpcResponse,
  XrpcResponseError,
  buildAgent,
  xrpc,
} from '@atproto/lex-client'
import {
  type Cid,
  checkCid,
  isCidForBytes,
  isPlainObject,
  parseCid,
} from '@atproto/lex-data'
import {
  type $Typed,
  type Issue,
  IssueInvalidType,
  IssueInvalidValue,
  LexValidationError,
  type RecordKeyValue,
  type RecordSchema,
  type Space,
  getMain,
} from '@atproto/lex-schema'
import {
  COMMIT_MAC_PROFILE,
  type Encapsulation,
  type MacProfile,
  RECORD_MAC_PROFILE,
  RepoCommit,
  type SpaceCommit,
  SpaceMacError,
  SpaceRepoVerificationError,
  type VerifyMacParams,
  encapsulate,
  formatMacRequest,
  formatRecordPath,
  verifyCommit,
  verifyRecord,
  verifyRepoStar,
} from '@atproto/space'
import {
  type RecordKeyString,
  SpaceRef,
  type SpaceRefString,
} from '@atproto/syntax'
import { createDidResolver } from '@atproto-labs/did-resolver'
import type { AtprotoDidResolver } from './atproto-did-resolver.js'
import { RepoGapError } from './errors.js'
import {
  type RepoRemoved,
  type RepoWrite,
  repoRemoved,
  repoWrite,
} from './lexicons/com/atproto/space/defs.js'
import getBlob from './lexicons/com/atproto/space/getBlob.js'
import getLatestCommit from './lexicons/com/atproto/space/getLatestCommit.js'
import getRecord from './lexicons/com/atproto/space/getRecord.js'
import getRepo from './lexicons/com/atproto/space/getRepo.js'
import listBlobs from './lexicons/com/atproto/space/listBlobs.js'
import listRecords, {
  type Record as ListRecordsRecord,
} from './lexicons/com/atproto/space/listRecords.js'
import listRepoOps from './lexicons/com/atproto/space/listRepoOps.js'
import listWriters from './lexicons/com/atproto/space/listWriters.js'
import type {
  SpaceCollection,
  SpaceRecordInput,
  SpaceRecordSchema,
} from './space-collection.js'
import {
  type BuildSpaceCredentialProviderOptions,
  type SpaceCredentialProvider,
  SpaceCredentialProviderCache,
  type SpaceCredentialProviderOptions,
  buildSpaceCredentialProvider,
} from './space-credential-provider.js'
import type { SpaceCredential } from './space-credential.js'

export type * from './client-attestation-provider.js'
export type * from './delegation-token-provider.js'
export type {
  AtprotoDidResolver,
  BuildSpaceCredentialProviderOptions,
  SpaceCollection,
  SpaceCredential,
  SpaceCredentialProvider,
  SpaceCredentialProviderOptions,
  SpaceRecordInput,
  SpaceRecordSchema,
}
export { SpaceRef }

export declare namespace SpaceReader {
  /** Requests made with a space credential are not proxied, nor labeled. */
  type ReaderXrpcOptions<
    M extends Query | Procedure,
    K extends 'params' | 'body',
  > = Omit<XrpcOptions<M>, K | 'service' | 'labelers'>

  export type ListedRecord = ListRecordsRecord

  /**
   * A repo of the writer set, at the latest update to it: its latest write
   * (`repoWrite`), or its removal from the writer set (`repoRemoved`).
   */
  export type ListedWriter = $Typed<RepoWrite> | $Typed<RepoRemoved>

  export type Options = BuildSpaceCredentialProviderOptions & {
    /**
     * Obtains the space credentials, in place of `delegationTokenProvider` and
     * `clientAttestationProvider`. Use it to share credentials between readers
     * of a space.
     */
    credentialProvider?: SpaceCredentialProvider

    /** Used for all requests. */
    fetch?: typeof globalThis.fetch
  }

  /** The account whose repo, within the space, a request targets. */
  export type RepoParam = { repo: DidString }

  export type ListWritersOptions = ReaderXrpcOptions<
    typeof listWriters,
    'params'
  > & {
    limit?: number
    /** A space revision (exclusive), e.g. the highest `spaceRev` seen so far. */
    cursor?: string
  }

  export type ListRecordsOptions = ReaderXrpcOptions<
    typeof listRecords,
    'params'
  > &
    RepoParam & {
      collection?: NsidString
      limit?: number
      cursor?: string
      excludeValues?: boolean
    }

  export type RecordsOptions = Omit<
    ListRecordsOptions,
    'collection' | 'excludeValues'
  >

  export type ListOptions = RecordsOptions

  export type ListOutput<T extends RecordSchema> = Omit<
    InferMethodOutputBody<typeof listRecords>,
    'records'
  > & {
    /** Every listed record, flagged with whether it matched the schema. */
    records: ListRecordItem<Infer<T>>[]
  }

  export type ListRecordItem<Value extends LexMap> = Omit<
    ListedRecord,
    'value'
  > &
    (
      | { valid: true; value: Value }
      | { valid: false; value?: LexMap; error: LexValidationError }
    )

  /** A valid record of each collection of `T`, its value keyed by `K`. */
  type ValidRecord<
    T extends RecordSchema,
    K extends 'value' | 'record',
  > = T extends unknown // Distributes over unions
    ? { valid: true; collection: T['$type'] } & { [_ in K]: Infer<T> }
    : never

  /**
   * A listed record of a repo, flagged with whether it is valid: of a
   * collection declared by the space type, and matching the space type's
   * schema of that collection. Checking `collection` narrows `value`.
   */
  export type RecordsItem<S extends Space = Space> = Omit<
    ListedRecord,
    'collection' | 'value'
  > &
    (
      | ValidRecord<SpaceRecordSchema<S>, 'value'>
      | {
          valid: false
          collection: NsidString
          value?: LexMap
          error: LexValidationError
        }
    )

  export type GetRecordOptions = ReaderXrpcOptions<typeof getRecord, 'params'> &
    RepoParam

  export type GetLatestCommitOptions = ReaderXrpcOptions<
    typeof getLatestCommit,
    'params'
  > &
    RepoParam

  export type GetRepoOptions = ReaderXrpcOptions<typeof getRepo, 'params'> &
    RepoParam

  export type ListRepoOpsOptions = ReaderXrpcOptions<
    typeof listRepoOps,
    'params'
  > &
    RepoParam & {
      /** A repo revision (exclusive). */
      since?: string
      cursor?: string
      limit?: number
      excludeValues?: boolean
    }

  export type GetBlobOptions = ReaderXrpcOptions<typeof getBlob, 'params'> &
    RepoParam & { cid: Cid | CidString }

  export type ListBlobsOptions = ReaderXrpcOptions<typeof listBlobs, 'params'> &
    RepoParam & {
      cursor?: string
      limit?: number
    }

  /** A record of a repo in the space, verified against the repo's commit. */
  export type RepoRecord = {
    collection: NsidString
    rkey: RecordKeyString
    cid: Cid
    record: LexMap
  }

  /**
   * A repo of the space, read in full. Its records are verified against its
   * commit as they are read: all of them must be read before trusting any.
   *
   * @note To avoid resource leaks, it must be disposed of (e.g. with `await
   * using`), or its records read.
   */
  export type Repo = AsyncDisposable & {
    commit: SpaceCommit
    records: AsyncGenerator<RepoRecord>
  }

  /** The state of a repo, as known to a syncer. */
  export type RepoHead = {
    /** The revision of the commit the state matches. */
    rev: string
    /** The LtHash state of the repo's records (see `RepoCommit`). */
    state: Uint8Array
  }

  /** Looks up the CID of a record, in the syncer's copy of a repo. */
  export type CidLookup = (
    collection: NsidString,
    rkey: RecordKeyString,
  ) => Cid | null | undefined | Promise<Cid | null | undefined>

  export type RecordChange = {
    collection: NsidString
    rkey: RecordKeyString
    /** The record's CID after the sync, or `null` if it was deleted. */
    cid: Cid | null
    /** The record's CID before the sync, or `null` if it was created. */
    prev: Cid | null
    /** The record's value, unless it was deleted. */
    record?: LexMap
  }

  export type SyncRepoOptions = {
    repo: DidString
    head: RepoHead
    lookup: CidLookup
    signal?: AbortSignal
  }

  export type RepoChanges = {
    commit: SpaceCommit
    head: RepoHead
    /** The changes since `head`, one per record (as of the commit). */
    changes: RecordChange[]
  }

  export type RepoSnapshot = {
    commit: SpaceCommit
    head: RepoHead
    records: RepoRecord[]
  }

  export type PullRepoOptions = {
    repo: DidString
    signal?: AbortSignal
  } & (
    | { head?: undefined; lookup?: CidLookup }
    | {
        /** The state of the syncer's copy of the repo, if any. */
        head?: RepoHead
        lookup: CidLookup
      }
  )

  /**
   * How a repo was brought up to date: with the changes since the known state,
   * with a snapshot of the repo in full, or as an empty repo, when its host
   * does not have it (e.g. never written to, or cleared and garbage collected).
   * An empty repo has no state to sync from: any copy of it is to be dropped.
   */
  export type RepoPull =
    | ({ type: 'changes' } & RepoChanges)
    | ({ type: 'snapshot' } & RepoSnapshot)
    | { type: 'empty' }

  /**
   * A space of type `S`, by its authority and key. The key can be left out for
   * space types with a literal key.
   */
  export type AuthorityRef<S extends Space> = {
    authority: DidString
  } & (S['key'] extends `literal:${string}`
    ? { skey?: RecordKeyValue<S['key']> }
    : { skey: RecordKeyValue<S['key']> })

  export type AllRecordsOptions = {
    /** How many repos to fetch at once. @default 4 */
    concurrency?: number
    signal?: AbortSignal
  }

  /**
   * A record of the space, flagged with whether it is valid, as
   * {@link RecordsItem} is. Checking `collection` narrows `record`.
   */
  export type AllRecordsItem<S extends Space = Space> = {
    /** The account whose repo holds the record. */
    repo: DidString
    rkey: RecordKeyString
    cid: Cid
  } & (
    | ValidRecord<SpaceRecordSchema<S>, 'record'>
    | {
        valid: false
        collection: NsidString
        record: LexMap
        error: LexValidationError
      }
  )
}

/**
 * Reads a space of the type described by `schema`, with a space credential
 * obtained in exchange for delegation tokens (see
 * {@link DelegationTokenProvider}). Use it to sync a space without acting for a
 * specific user, e.g. in a sync service; see `SpaceClient` to act for a user.
 *
 * Requests are sent to the PDS of the account whose repo they target, or to
 * the space host (the authority's PDS) when they target no repo. Records,
 * commits, repos and blobs are verified against the MAC, or CID, their host
 * provided.
 *
 * @example
 * ```typescript
 * const reader = SpaceReader.openSpace(com.example.forum, spaceUri, {
 *   delegationTokenProvider: async (space) => requestDelegationToken(space),
 * })
 *
 * for await (const record of reader.allRecords()) {
 *   console.log(record.repo, record.collection, record.rkey, record.record)
 * }
 * ```
 */
export class SpaceReader<S extends Space = Space> {
  readonly uri: SpaceRefString

  readonly #resolver: AtprotoDidResolver
  readonly #fetch: typeof globalThis.fetch
  readonly #credentialProvider: SpaceCredentialProviderCache
  /** The space type's record schemas, by collection. */
  readonly #collectionSchemas: ReadonlyMap<NsidString, RecordSchema>
  readonly #classify: RecordClassifier

  /**
   * Reads a space, identified by its URI or by its authority and key, of the
   * type described by `ns` (a space schema, or a namespace exporting one as
   * `main`).
   *
   * @throws {TypeError} if the space is not of that type
   */
  static openSpace<const S extends Space>(
    ns: Main<S>,
    space: SpaceRefString | SpaceRef | SpaceReader.AuthorityRef<S>,
    options?: SpaceReader.Options,
  ): SpaceReader<S> {
    const schema = getMain(ns)
    const ref =
      typeof space === 'string'
        ? SpaceRef.parse(space)
        : space instanceof SpaceRef
          ? space
          : schema.spaceRefFor(
              space.authority,
              space.skey as RecordKeyValue<S['key']>,
            )
    return new SpaceReader(schema, ref, options)
  }

  /**
   * @throws {TypeError} if the space is not of the type described by `schema`
   */
  constructor(
    /** The space type, e.g. to restrict the collections read and written. */
    readonly schema: S,
    readonly ref: SpaceRef,
    {
      fetch = globalThis.fetch,
      didResolver = createDidResolver({ fetch }),
      clientAttestationProvider = undefined,
      delegationTokenProvider = undefined,
      notifyRegistrationProvider = undefined,
      credentialProvider = buildSpaceCredentialProvider({
        didResolver,
        fetch,
        clientAttestationProvider,
        delegationTokenProvider,
        notifyRegistrationProvider,
      }),
    }: SpaceReader.Options = {},
  ) {
    if (ref.spaceType !== schema.spaceType) {
      throw new TypeError(`${ref} is not a ${schema.spaceType} space`)
    }
    this.uri = ref.toString()

    this.#collectionSchemas = new Map(
      schema.collections.map((c): [NsidString, RecordSchema] => [c.$type, c]),
    )
    this.#classify = recordClassifier(this.#collectionSchemas)
    this.#resolver = didResolver
    this.#fetch = fetch
    this.#credentialProvider =
      SpaceCredentialProviderCache.for(credentialProvider)
  }

  /**
   * Lists the accounts holding a repo in the space (its writer set), as known
   * to the space host.
   */
  async listWriters({
    limit,
    cursor,
    ...options
  }: SpaceReader.ListWritersOptions = {}): Promise<
    XrpcResponse<typeof listWriters>
  > {
    return this.authorityXrpc(listWriters, {
      ...options,
      params: { space: this.uri, limit, cursor },
    })
  }

  /**
   * Iterates over the writer set of the space, at the latest update to each
   * repo, in ascending `spaceRev` order. A repo removed from the writer set is
   * listed as `repoRemoved`, and is not part of the space. A repo updated while
   * iterating may be yielded again, in which case its last entry is current.
   *
   * The highest `spaceRev` yielded can be used as `cursor` to only list the
   * repos updated since. Removals may be forgotten by the space host after 72
   * hours, so with an older cursor, list the whole writer set instead, and drop
   * the repos missing from it.
   */
  async *writers(
    options: SpaceReader.ListWritersOptions = {},
  ): AsyncGenerator<SpaceReader.ListedWriter, void, undefined> {
    let { cursor } = options
    do {
      const { body } = await this.listWriters({ ...options, cursor })
      for (const entry of body.repos) {
        // Entries of a kind unknown to this version are skipped.
        if (repoWrite.$isTypeOf(entry) || repoRemoved.$isTypeOf(entry)) {
          yield entry as SpaceReader.ListedWriter
        }
      }
      // Guard against a server returning the same cursor
      if (body.cursor === cursor) return
      cursor = body.cursor
    } while (cursor)
  }

  async listRecords({
    repo,
    collection,
    limit,
    cursor,
    excludeValues,
    ...options
  }: SpaceReader.ListRecordsOptions): Promise<
    XrpcResponse<typeof listRecords>
  > {
    return this.repoXrpc(repo, listRecords, {
      ...options,
      params: {
        space: this.uri,
        repo,
        collection,
        limit,
        cursor,
        excludeValues,
      },
    })
  }

  /**
   * Iterates over the records of a repo, in every collection, flagged with
   * whether they are valid: of a collection declared by the space type, and
   * matching the space type's schema of that collection. Records listed under
   * a collection other than their `$type` are invalid.
   *
   * @note Listed records are not covered by a MAC; see {@link getRepo} for a
   * verified copy of a repo.
   *
   * @example
   * ```typescript
   * for await (const record of space.records({ repo })) {
   *   if (!record.valid) record.error // LexValidationError
   *   else if (record.collection === com.example.post.$type) record.value // com.example.post.Main
   * }
   * ```
   */
  async *records(
    options: SpaceReader.RecordsOptions,
  ): AsyncGenerator<SpaceReader.RecordsItem<S>, void, undefined> {
    for await (const record of this.#listedRecords(options)) {
      yield listRecordItem(record, this.#classify) as SpaceReader.RecordsItem<S>
    }
  }

  /**
   * Lists a page of a collection's records, each validated against the space
   * type's schema of the collection. Records listed outside of the collection
   * are invalid.
   *
   * @example
   * ```typescript
   * const { records, cursor } = await space.list(com.example.post.$type, {
   *   repo,
   * })
   * for (const record of records) {
   *   if (record.valid) record.value // com.example.post.Main
   * }
   * ```
   */
  async list<const C extends SpaceCollection<S>>(
    collection: C,
    options: SpaceReader.ListOptions,
  ): Promise<SpaceReader.ListOutput<SpaceRecordSchema<S, C>>> {
    const classify = this.#collectionClassifier(collection)
    const { body } = await this.listRecords({ ...options, collection })
    const records = body.records.map((record) =>
      listRecordItem<Infer<SpaceRecordSchema<S, C>>>(record, classify),
    )
    return { ...body, records }
  }

  /**
   * Iterates over a collection's records, each validated against the space
   * type's schema of the collection, handling pagination. Records listed
   * outside of the collection are invalid.
   */
  async *listAll<const C extends SpaceCollection<S>>(
    collection: C,
    options: SpaceReader.ListOptions,
  ): AsyncGenerator<
    SpaceReader.ListRecordItem<Infer<SpaceRecordSchema<S, C>>>,
    void,
    undefined
  > {
    const classify = this.#collectionClassifier(collection)
    for await (const record of this.#listedRecords({
      ...options,
      collection,
    })) {
      yield listRecordItem<Infer<SpaceRecordSchema<S, C>>>(record, classify)
    }
  }

  /**
   * Classifies the records listed in `collection` (see {@link recordClassifier})
   * against the space type's schema of that collection only.
   *
   * @throws {TypeError} if `collection` is not declared by the space type
   */
  #collectionClassifier(collection: NsidString): RecordClassifier {
    const schema = this.collectionSchema(collection)
    return recordClassifier(new Map([[collection, schema]]))
  }

  /** Iterates over the listed records of a repo, across pages. */
  async *#listedRecords(
    options: SpaceReader.ListRecordsOptions,
  ): AsyncGenerator<ListRecordsRecord, void, undefined> {
    let { cursor } = options
    do {
      const { body } = await this.listRecords({ ...options, cursor })
      yield* body.records
      // Guard against a server returning the same cursor
      if (body.cursor === cursor) return
      cursor = body.cursor
    } while (cursor)
  }

  /**
   * Gets a record, verified against the MAC its host computed for the
   * request.
   *
   * @throws {SpaceRepoVerificationError} if the record fails verification
   */
  async getRecord(
    collection: NsidString,
    rkey: string,
    { repo, ...options }: SpaceReader.GetRecordOptions,
  ): Promise<XrpcResponse<typeof getRecord>> {
    const params = { space: this.uri, repo, collection, rkey }
    const uri = `${this.uri}/${repo}/${collection}/${rkey}` as const
    return this.#verified(`Record ${uri} failed verification`, async (kem) => {
      const { response, mac } = await this.#withMac(
        repo,
        getRecord,
        RECORD_MAC_PROFILE,
        { ...options, params },
        kem,
      )
      await verifyRecord(response.body, { ...mac, uri })
      return response
    })
  }

  /**
   * Gets the current commit of a repo, verified against the MAC its host
   * computed for the request.
   *
   * @throws {SpaceRepoVerificationError} if the commit fails verification
   */
  async getLatestCommit({
    repo,
    ...options
  }: SpaceReader.GetLatestCommitOptions): Promise<
    XrpcResponse<typeof getLatestCommit>
  > {
    const params = { space: this.uri, repo }
    return this.#verified(
      `Repo ${repo} commit failed verification`,
      async (kem) => {
        const { response, mac } = await this.#withMac(
          repo,
          getLatestCommit,
          COMMIT_MAC_PROFILE,
          { ...options, params },
          kem,
        )
        verifyCommit(response.body.commit, { ...params, ...mac })
        return response
      },
    )
  }

  /**
   * Gets a repo in full. Its commit is verified against the MAC its host
   * computed for the request, and its records against its commit as they are
   * read: all of them must be read before trusting any.
   *
   * @note The returned repo must be disposed of, or its records read.
   * @throws {SpaceRepoVerificationError} if the repo fails verification
   */
  async getRepo({
    repo,
    ...options
  }: SpaceReader.GetRepoOptions): Promise<SpaceReader.Repo> {
    const params = { space: this.uri, repo }
    return this.#verified(`Repo ${repo} failed verification`, async (kem) => {
      const { response, mac } = await this.#withMac(
        repo,
        getRepo,
        COMMIT_MAC_PROFILE,
        { ...options, params },
        kem,
      )
      // @TODO Stream the archive, once lex-client can stream response bodies
      return verifyRepoStar([response.body], { ...params, ...mac })
    })
  }

  /**
   * Lists a page of a repo's operation log. The repo's current commit, included
   * with every page, is verified against the MAC its host computed for the
   * request.
   *
   * @see {@link syncRepo} to apply the operations to a known state.
   * @throws {SpaceRepoVerificationError} if the commit fails verification
   */
  async listRepoOps({
    repo,
    since,
    cursor,
    limit,
    excludeValues,
    ...options
  }: SpaceReader.ListRepoOpsOptions): Promise<
    XrpcResponse<typeof listRepoOps>
  > {
    const params = {
      space: this.uri,
      repo,
      since,
      cursor,
      limit,
      excludeValues,
    }
    return this.#verified(
      `Repo ${repo} commit failed verification`,
      async (kem) => {
        const { response, mac } = await this.#withMac(
          repo,
          listRepoOps,
          COMMIT_MAC_PROFILE,
          { ...options, params },
          kem,
        )
        verifyCommit(response.body.commit, { space: this.uri, repo, ...mac })
        return response
      },
    )
  }

  /**
   * Brings a known state of a repo up to date, from its operation log. Every
   * operation is checked against the state (using `lookup` for the CIDs of the
   * records it touches), and the resulting state against the repo's commit.
   *
   * @throws {RepoGapError} if the operation log cannot be applied to `head`
   * @throws {SpaceRepoVerificationError} if the repo fails verification
   */
  async syncRepo({
    repo,
    head,
    lookup,
    signal,
  }: SpaceReader.SyncRepoOptions): Promise<SpaceReader.RepoChanges> {
    const repoCommit = RepoCommit.fromState(head.state)
    const changes = new Map<string, SpaceReader.RecordChange>()

    let commit: SpaceCommit
    let cursor: string | undefined
    let rev = head.rev
    do {
      const { body } = await this.listRepoOps({
        repo,
        since: head.rev,
        cursor,
        signal,
      })

      for (const op of body.ops) {
        // Operations sharing a revision were applied atomically.
        if (op.rev <= head.rev || op.rev < rev) {
          throw new RepoGapError(`Repo ${repo} operations are out of order`)
        }
        rev = op.rev

        const path = formatRecordPath(op.collection, op.rkey)
        const change = changes.get(path)
        const current = change
          ? change.cid
          : ((await lookup(op.collection, op.rkey)) ?? null)
        const prev = op.prev ? parseCid(op.prev) : null
        if (!cidEquals(prev, current)) {
          throw new RepoGapError(`Repo ${repo} diverged at ${path}`)
        }

        const cid = op.cid ? parseCid(op.cid) : null
        if (op.value && !(cid && (await cidForLex(op.value)).equals(cid))) {
          throw new SpaceRepoVerificationError(
            `Record ${path} failed verification`,
          )
        }

        repoCommit.applyOp({
          collection: op.collection,
          rkey: op.rkey,
          cid,
          prev,
        })
        changes.set(path, {
          collection: op.collection,
          rkey: op.rkey,
          cid,
          prev: change ? change.prev : prev,
          record: op.value,
        })
      }

      // Every page carries the repo's current commit. The last page's is checked
      // against the state once all the operations are applied.
      commit = body.commit
      cursor = body.cursor
    } while (cursor)

    if (!repoCommit.matches(commit)) {
      throw new RepoGapError(`Repo ${repo} diverged from its commit`)
    }

    // A value is only listed with the last operation on its record.
    for (const change of changes.values()) {
      if (change.cid && !change.record) {
        const { collection, rkey } = change
        const { body } = await this.getRecord(collection, rkey, {
          repo,
          signal,
        })
        if (!parseCid(body.cid).equals(change.cid)) {
          throw new RepoGapError(`Repo ${repo} changed while syncing`)
        }
        change.record = body.value
      }
    }

    return {
      commit,
      head: { rev: commit.rev, state: repoCommit.setHash.state() },
      // A record created then deleted since `head` did not change.
      changes: [...changes.values()].filter((c) => c.cid || c.prev),
    }
  }

  /**
   * Gets a repo in full, and the state needed to {@link syncRepo} it later.
   *
   * @throws {SpaceRepoVerificationError} if the repo fails verification
   */
  async getRepoSnapshot({
    repo,
    signal,
  }: {
    repo: DidString
    signal?: AbortSignal
  }): Promise<SpaceReader.RepoSnapshot> {
    const { commit, records } = await this.getRepo({ repo, signal })
    const collected: SpaceReader.RepoRecord[] = []
    for await (const record of records) collected.push(record)
    const state = RepoCommit.fromRecords(collected).setHash.state()
    return { commit, head: { rev: commit.rev, state }, records: collected }
  }

  /**
   * Brings a repo up to date: incrementally from its known state (`head` and
   * `lookup`), and in full when there is none (e.g. on the first pull), or
   * when the incremental sync fails. A repo its host does not have is pulled
   * as an empty repo.
   */
  async pullRepo({
    repo,
    head,
    lookup,
    signal,
  }: SpaceReader.PullRepoOptions): Promise<SpaceReader.RepoPull> {
    if (head) {
      try {
        const changes = await this.syncRepo({ repo, head, lookup, signal })
        return { type: 'changes', ...changes }
      } catch (err) {
        if (isRepoNotFound(err)) return { type: 'empty' }
        if (
          !(err instanceof RepoGapError) &&
          !(err instanceof SpaceRepoVerificationError)
        ) {
          throw err
        }
      }
    }

    let snapshot: SpaceReader.RepoSnapshot
    try {
      snapshot = await this.getRepoSnapshot({ repo, signal })
    } catch (err) {
      if (isRepoNotFound(err)) return { type: 'empty' }
      throw err
    }
    if (head && snapshot.commit.rev < head.rev) {
      throw new RepoGapError(`Repo ${repo} is older than its known state`)
    }
    return { type: 'snapshot', ...snapshot }
  }

  /**
   * Iterates over the records of every repo in the writer set of the space.
   * Each repo is fetched in full, and verified, before its records are
   * yielded. Repos removed from the writer set, and repos that are unavailable
   * (not found, taken down, suspended or deactivated), are skipped.
   *
   * Every record is yielded, flagged with whether it is valid, as by
   * {@link records}: of a collection declared by the space type, and matching
   * the space type's schema of that collection. Records stored under a
   * collection other than their `$type` are invalid.
   *
   * @example
   * ```typescript
   * for await (const record of space.allRecords()) {
   *   if (record.valid && record.collection === com.example.post.$type) {
   *     record.record // com.example.post.Main
   *   }
   * }
   * ```
   */
  async *allRecords({
    concurrency = 4,
    signal,
  }: SpaceReader.AllRecordsOptions = {}): AsyncGenerator<
    SpaceReader.AllRecordsItem<S>,
    void,
    undefined
  > {
    // A repo listed again was updated while listing: its last entry is current.
    const writers = new Map<DidString, SpaceReader.ListedWriter>()
    for await (const entry of this.writers({ signal })) {
      writers.set(entry.repo, entry)
    }

    const queue = [...writers.values()]
      .filter((entry) => repoWrite.$isTypeOf(entry))
      .map((entry) => entry.repo)
    while (queue.length) {
      const batch = queue.splice(0, concurrency)
      const snapshots = await Promise.all(
        batch.map((repo) =>
          this.getRepoSnapshot({ repo, signal }).catch((err) => {
            if (err instanceof XrpcResponseError) {
              switch (err.error) {
                // Errors meaning that a member's repo holds no readable data.
                case 'RepoNotFound':
                case 'RepoTakendown':
                case 'RepoSuspended':
                case 'RepoDeactivated':
                  return undefined
              }
            }
            throw err
          }),
        ),
      )
      for (const [i, snapshot] of snapshots.entries()) {
        for (const record of snapshot?.records ?? []) {
          const item = { ...record, repo: batch[i] }
          const result = this.#classify(record.collection, record.record)
          yield (
            result.valid
              ? { ...item, valid: true, record: result.value }
              : { ...item, valid: false, error: result.error }
          ) as SpaceReader.AllRecordsItem<S>
        }
      }
    }
  }

  /**
   * The space type's schema of `collection`.
   *
   * @throws {TypeError} if `collection` is not declared by the space type
   */
  protected collectionSchema(collection: NsidString): RecordSchema {
    const schema = this.#collectionSchemas.get(collection)
    if (!schema) {
      throw new TypeError(
        `${collection} is not a collection of ${this.schema.spaceType} spaces`,
      )
    }
    return schema
  }

  /**
   * Gets a blob, verified against its CID.
   *
   * @throws {SpaceRepoVerificationError} if the blob fails verification
   */
  async getBlob({
    repo,
    cid: cidInput,
    ...options
  }: SpaceReader.GetBlobOptions): Promise<XrpcResponse<typeof getBlob>> {
    const cid = typeof cidInput === 'string' ? parseCid(cidInput) : cidInput
    if (!checkCid(cid, { flavor: 'raw' })) {
      throw new TypeError(`${cid} is not a raw CID`)
    }
    // @TODO Stream the blob, once lex-client can stream response bodies
    const response = await this.repoXrpc(repo, getBlob, {
      ...options,
      params: { space: this.uri, repo, cid: cid.toString() },
    })
    if (!(await isCidForBytes(cid, response.body))) {
      throw new SpaceRepoVerificationError(`Blob ${cid} failed verification`)
    }
    return response
  }

  /** Lists the CIDs of the blobs referenced by a repo's records. */
  async listBlobs({
    repo,
    cursor,
    limit,
    ...options
  }: SpaceReader.ListBlobsOptions): Promise<XrpcResponse<typeof listBlobs>> {
    return this.repoXrpc(repo, listBlobs, {
      ...options,
      params: { space: this.uri, repo, cursor, limit },
    })
  }

  /**
   * Makes a request to the space host (the authority's PDS), with the space
   * credential presented to the space authority.
   */
  protected async authorityXrpc<const M extends Query | Procedure>(
    ns: Main<M>,
    options: XrpcOptions<M>,
  ): Promise<XrpcResponse<M>> {
    return this.credentialXrpc(this.ref.spaceDid, ns, options)
  }

  /**
   * Makes a request to the host (PDS) of a repo in the space, with the space
   * credential presented to the repo's account.
   */
  protected async repoXrpc<const M extends Query | Procedure>(
    repo: DidString,
    ns: Main<M>,
    options: XrpcOptions<M>,
  ): Promise<XrpcResponse<M>> {
    return this.credentialXrpc(repo, ns, options)
  }

  /**
   * Makes a request with the space credential, presented to `audience` (whose
   * PDS receives the request).
   */
  protected async credentialXrpc<const M extends Query | Procedure>(
    audience: DidString,
    ns: Main<M>,
    options: XrpcOptions<M>,
  ): Promise<XrpcResponse<M>> {
    const agent = await this.buildCredentialXrpcAgent(audience, options)
    try {
      return await xrpc(agent, ns, options)
    } catch (err) {
      if (
        !('renew' in options && options.renew) &&
        !options.signal?.aborted &&
        err instanceof XrpcAuthenticationError
      ) {
        // Retry with a new credential
        const agent = await this.buildCredentialXrpcAgent(audience, {
          signal: options.signal,
          renew: true,
        })
        return xrpc(agent, ns, options)
      }

      throw err
    }
  }

  protected async buildCredentialXrpcAgent(
    audience: DidString,
    { signal, renew }: SpaceCredentialProviderOptions = {},
  ): Promise<Agent> {
    // Did resolution first, to avoid unnecessary credential requests if the
    // audience's PDS cannot be resolved.
    const service = await this.#resolver
      .resolve(audience, { signal, noCache: renew })
      .then(extractPdsUrl)

    signal?.throwIfAborted?.()

    const credential = await this.authorize({ signal, renew })

    signal?.throwIfAborted?.()

    const headers = await credential.headers(audience)

    return buildAgent({ service, headers, fetch: this.#fetch })
  }

  /**
   * Obtains the space credential (or a new one, with `renew`). The credential
   * is otherwise obtained on first use: call this to check, early, that the
   * space grants access.
   *
   * @throws {XrpcResponseError} if the credential cannot be obtained, e.g.
   * `SpaceNotFound` (not granted access), `AppNotAuthorized` or `SpaceDeleted`
   */
  async authorize(
    options?: SpaceCredentialProviderOptions,
  ): Promise<SpaceCredential> {
    return this.#credentialProvider.getCredential(this.ref, options)
  }

  /**
   * Makes a request to a member's PDS asking for a MAC (with `Accept-Signature`),
   * using a new key share (derived from the member's `#atproto_kem` key) for
   * every attempt, retries included. Returns what the response's MAC is
   * verified with.
   */
  async #withMac<const M extends Query>(
    repo: DidString,
    ns: Main<M>,
    profile: MacProfile,
    options: XrpcOptions<M>,
    refreshKemKey: boolean,
  ): Promise<{ response: XrpcResponse<M>; mac: VerifyMacParams }> {
    const kemKey = await this.#resolveKemKey(
      repo,
      options.signal,
      refreshKemKey,
    )

    const { headers: headersInit } = options
    let encapsulation!: Encapsulation
    const response = await this.repoXrpc(repo, ns, {
      ...options,
      // The encapsulated key can only be used once, even on retries, so we
      // generate a new one for each request.
      headers: async () => {
        options.signal?.throwIfAborted?.()
        const headers = new Headers(
          typeof headersInit === 'function' ? await headersInit() : headersInit,
        )
        options.signal?.throwIfAborted?.()
        encapsulation = await encapsulate(kemKey)
        options.signal?.throwIfAborted?.()
        headers.set(
          'accept-signature',
          formatMacRequest(profile, encapsulation.keyShare),
        )
        return headers
      },
    } as XrpcOptions<M>)

    // A missing MAC fails verification, like an invalid one.
    return { response, mac: { ...encapsulation, headers: response.headers } }
  }

  /**
   * Resolves the `#atproto_kem` key of a repo's account. A DID document without
   * one is resolved again, as the key may have been added since it was cached.
   */
  async #resolveKemKey(
    repo: DidString,
    signal: AbortSignal | undefined,
    noCache: boolean,
  ): Promise<DidString> {
    const didDocument = await this.#resolver.resolve(repo, { signal, noCache })
    try {
      return formatDidVerificationMethod(extractKemKey(didDocument))
    } catch (err) {
      if (noCache) throw err
      return this.#resolveKemKey(repo, signal, true)
    }
  }

  /**
   * Retries a verification once, with the author's KEM key re-resolved, as it
   * may have been rotated since it was cached.
   *
   * @throws {SpaceRepoVerificationError} if both attempts fail verification
   */
  async #verified<T>(
    message: string,
    attempt: (refreshKemKey: boolean) => Promise<T>,
  ): Promise<T> {
    try {
      return await attempt(false)
    } catch (err) {
      if (!isVerificationError(err)) throw err
    }
    try {
      return await attempt(true)
    } catch (err) {
      if (!isVerificationError(err)) throw err
      throw new SpaceRepoVerificationError(message, { cause: err })
    }
  }
}

function isRepoNotFound(err: unknown): boolean {
  return err instanceof XrpcResponseError && err.error === 'RepoNotFound'
}

function isVerificationError(err: unknown): boolean {
  return (
    err instanceof SpaceMacError || err instanceof SpaceRepoVerificationError
  )
}

function cidEquals(a: Cid | null, b: Cid | null): boolean {
  return a === null || b === null ? a === b : a.equals(b)
}

/** How a record is classified (see `SpaceReader.RecordsItem`). */
type Classification =
  { valid: true; value: LexMap } | { valid: false; error: LexValidationError }

type RecordClassifier = (
  collection: NsidString,
  value: unknown,
) => Classification

/**
 * Classifies the records of a space: valid if they match the schema of their
 * collection among `schemas`. The records of other collections, and the
 * records stored under a collection other than their `$type` (not every host
 * checks it), are invalid.
 */
function recordClassifier(
  schemas: ReadonlyMap<NsidString, RecordSchema>,
): RecordClassifier {
  const expected = [...schemas.keys()]

  return (collection, value) => {
    if (!isPlainObject(value) || !('$type' in value)) {
      return invalid(new IssueInvalidType([], value, ['$typed']))
    }

    const { $type } = value
    if (typeof $type !== 'string') {
      return invalid(new IssueInvalidType(['$type'], $type, ['string']))
    }
    if ($type !== collection) {
      return invalid(new IssueInvalidValue(['$type'], $type, [collection]))
    }

    const schema = schemas.get($type as NsidString)
    if (!schema) {
      return invalid(new IssueInvalidValue(['$type'], $type, expected))
    }

    const result = schema.safeValidate(value)
    return result.success
      ? { valid: true, value: result.value }
      : { valid: false, error: result.reason }
  }
}

function invalid(issue: Issue): { valid: false; error: LexValidationError } {
  return { valid: false, error: new LexValidationError([issue]) }
}

function listRecordItem<Value extends LexMap>(
  record: ListRecordsRecord,
  classify: RecordClassifier,
): SpaceReader.ListRecordItem<Value> {
  const result = classify(record.collection, record.value)
  return result.valid
    ? { ...record, valid: true, value: result.value as Value }
    : { ...record, valid: false, error: result.error }
}
