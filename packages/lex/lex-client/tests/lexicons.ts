/**
 * Hand-written example Lexicon schemas for the `@atproto/lex-client` test suite.
 *
 * This replaces the previous `codegen:lex:tests` step, which generated a schema
 * tree from the repo-root `lexicons/` directory (including the public
 * `app` / `bsky` namespaces). The tests only need a handful of schemas, so they
 * are declared here with the `l` builder instead of being generated:
 *
 * - `com.example.*` — brand-new, test-only record/query/procedure/object schemas
 *   standing in for the former public ones.
 * - `com.atproto.repo.*` — faithful (trimmed) mirrors of the real repo methods,
 *   defined locally so the tests do not depend on the root lexicons. They must
 *   stay shape-compatible with the wire payloads the `Client` sends/receives
 *   (the client itself uses its own generated `src/lexicons/`).
 *
 * Member types are declared explicitly and threaded through `l.typedRef<T>()`,
 * mirroring generated output, so union members keep their fields (needed for
 * `$isTypeOf` narrowing and for the inferred `Preference` type).
 */
import { l } from '@atproto/lex-schema'

/* -------------------------------------------------------------------------- */
/* com.example.* — test-only schemas (formerly public namespace)               */
/* -------------------------------------------------------------------------- */

type AdultContentPref = {
  $type?: 'com.example.actor.defs#adultContentPref'
  enabled: boolean
}
const adultContentPref = l.typedObject<AdultContentPref>(
  'com.example.actor.defs',
  'adultContentPref',
  l.object({ enabled: l.withDefault(l.boolean(), false) }),
)

type ContentLabelPref = {
  $type?: 'com.example.actor.defs#contentLabelPref'
  label: string
  visibility: string
}
const contentLabelPref = l.typedObject<ContentLabelPref>(
  'com.example.actor.defs',
  'contentLabelPref',
  l.object({ label: l.string(), visibility: l.string() }),
)

export type Preferences = (
  | l.$Typed<AdultContentPref>
  | l.$Typed<ContentLabelPref>
  | l.Unknown$TypedObject
)[]
export type Preference = Preferences[number]

const preferences = l.array<Preference>(
  l.typedUnion(
    [
      l.typedRef<AdultContentPref>((() => adultContentPref) as any),
      l.typedRef<ContentLabelPref>((() => contentLabelPref) as any),
    ],
    // open union — unknown preference `$type`s pass through
    false,
  ),
)

const getPreferencesOutput = l.jsonPayload({ preferences })
const getPreferences = l.query(
  'com.example.actor.getPreferences',
  l.params(),
  getPreferencesOutput,
)

const putPreferencesInput = l.jsonPayload({ preferences })
const putPreferences = l.procedure(
  'com.example.actor.putPreferences',
  l.params(),
  putPreferencesInput,
  l.payload(),
)

const post = l.record(
  'tid',
  'com.example.feed.post',
  l.object({
    text: l.string({ maxLength: 3000, maxGraphemes: 300 }),
    createdAt: l.string({ format: 'datetime' }),
  }),
)

const generator = l.record(
  'any',
  'com.example.feed.generator',
  l.object({
    did: l.string({ format: 'did' }),
    displayName: l.string({ maxGraphemes: 24, maxLength: 240 }),
    createdAt: l.string({ format: 'datetime' }),
  }),
)

const profile = l.record(
  'literal:self',
  'com.example.actor.profile',
  l.object({
    displayName: l.optional(l.string({ maxGraphemes: 64, maxLength: 640 })),
  }),
)

/* -------------------------------------------------------------------------- */
/* com.atproto.repo.* — local mirrors of the real repo methods                 */
/* -------------------------------------------------------------------------- */

const createRecordInput = l.jsonPayload({
  repo: l.string({ format: 'at-identifier' }),
  collection: l.string({ format: 'nsid' }),
  rkey: l.optional(l.string({ format: 'record-key', maxLength: 512 })),
  validate: l.optional(l.boolean()),
  record: l.lexMap(),
  swapCommit: l.optional(l.string({ format: 'cid' })),
})
const createRecordOutput = l.jsonPayload({
  uri: l.string({ format: 'at-uri' }),
  cid: l.string({ format: 'cid' }),
})
export type CreateRecordOutputBody = l.InferPayloadBody<
  typeof createRecordOutput,
  Uint8Array
>
const createRecord = l.procedure(
  'com.atproto.repo.createRecord',
  l.params(),
  createRecordInput,
  createRecordOutput,
  ['InvalidSwap'],
)

const getRecordParams = l.params({
  repo: l.string({ format: 'at-identifier' }),
  collection: l.string({ format: 'nsid' }),
  rkey: l.string({ format: 'record-key' }),
  cid: l.optional(l.string({ format: 'cid' })),
})
const getRecordOutput = l.jsonPayload({
  uri: l.string({ format: 'at-uri' }),
  cid: l.optional(l.string({ format: 'cid' })),
  value: l.lexMap(),
})
export type GetRecordOutputBody = l.InferPayloadBody<
  typeof getRecordOutput,
  Uint8Array
>
const getRecord = l.query(
  'com.atproto.repo.getRecord',
  getRecordParams,
  getRecordOutput,
  ['RecordNotFound'],
)

const uploadBlobOutput = l.jsonPayload({ blob: l.blob() })
export type UploadBlobOutputBody = l.InferPayloadBody<
  typeof uploadBlobOutput,
  Uint8Array
>
const uploadBlob = l.procedure(
  'com.atproto.repo.uploadBlob',
  l.params(),
  l.payload('*/*'),
  uploadBlobOutput,
)

const APPLY_WRITES = 'com.atproto.repo.applyWrites'

type ApplyWritesCreate = {
  $type?: 'com.atproto.repo.applyWrites#create'
  collection: l.NsidString
  rkey?: l.RecordKeyString
  value: l.LexMap
}
const applyWritesCreate = l.typedObject<ApplyWritesCreate>(
  APPLY_WRITES,
  'create',
  l.object({
    collection: l.string({ format: 'nsid' }),
    rkey: l.optional(l.string({ format: 'record-key', maxLength: 512 })),
    value: l.lexMap(),
  }),
)

type ApplyWritesUpdate = {
  $type?: 'com.atproto.repo.applyWrites#update'
  collection: l.NsidString
  rkey: l.RecordKeyString
  value: l.LexMap
}
const applyWritesUpdate = l.typedObject<ApplyWritesUpdate>(
  APPLY_WRITES,
  'update',
  l.object({
    collection: l.string({ format: 'nsid' }),
    rkey: l.string({ format: 'record-key' }),
    value: l.lexMap(),
  }),
)

type ApplyWritesDelete = {
  $type?: 'com.atproto.repo.applyWrites#delete'
  collection: l.NsidString
  rkey: l.RecordKeyString
}
const applyWritesDelete = l.typedObject<ApplyWritesDelete>(
  APPLY_WRITES,
  'delete',
  l.object({
    collection: l.string({ format: 'nsid' }),
    rkey: l.string({ format: 'record-key' }),
  }),
)

type ApplyWritesCreateResult = {
  $type?: 'com.atproto.repo.applyWrites#createResult'
  uri: l.AtUriString
  cid: l.CidString
  validationStatus?: string
}
const applyWritesCreateResult = l.typedObject<ApplyWritesCreateResult>(
  APPLY_WRITES,
  'createResult',
  l.object({
    uri: l.string({ format: 'at-uri' }),
    cid: l.string({ format: 'cid' }),
    validationStatus: l.optional(l.string()),
  }),
)

type ApplyWritesUpdateResult = {
  $type?: 'com.atproto.repo.applyWrites#updateResult'
  uri: l.AtUriString
  cid: l.CidString
  validationStatus?: string
}
const applyWritesUpdateResult = l.typedObject<ApplyWritesUpdateResult>(
  APPLY_WRITES,
  'updateResult',
  l.object({
    uri: l.string({ format: 'at-uri' }),
    cid: l.string({ format: 'cid' }),
    validationStatus: l.optional(l.string()),
  }),
)

type ApplyWritesDeleteResult = {
  $type?: 'com.atproto.repo.applyWrites#deleteResult'
}
const applyWritesDeleteResult = l.typedObject<ApplyWritesDeleteResult>(
  APPLY_WRITES,
  'deleteResult',
  l.object({}),
)

const applyWritesInput = l.jsonPayload({
  repo: l.string({ format: 'at-identifier' }),
  validate: l.optional(l.boolean()),
  writes: l.array(
    l.typedUnion(
      [
        l.typedRef<ApplyWritesCreate>((() => applyWritesCreate) as any),
        l.typedRef<ApplyWritesUpdate>((() => applyWritesUpdate) as any),
        l.typedRef<ApplyWritesDelete>((() => applyWritesDelete) as any),
      ],
      // closed union — only create/update/delete writes are valid
      true,
    ),
  ),
  swapCommit: l.optional(l.string({ format: 'cid' })),
})
const applyWritesOutput = l.jsonPayload({
  results: l.optional(
    l.array(
      l.typedUnion(
        [
          l.typedRef<ApplyWritesCreateResult>(
            (() => applyWritesCreateResult) as any,
          ),
          l.typedRef<ApplyWritesUpdateResult>(
            (() => applyWritesUpdateResult) as any,
          ),
          l.typedRef<ApplyWritesDeleteResult>(
            (() => applyWritesDeleteResult) as any,
          ),
        ],
        true,
      ),
    ),
  ),
})
export type ApplyWritesOutputBody = l.InferPayloadBody<
  typeof applyWritesOutput,
  Uint8Array
>
const applyWrites = l.procedure(
  APPLY_WRITES,
  l.params(),
  applyWritesInput,
  applyWritesOutput,
  ['InvalidSwap'],
)

/* -------------------------------------------------------------------------- */
/* Namespace assembly — mirrors the dotted access of generated lexicon trees   */
/* -------------------------------------------------------------------------- */

export const com = {
  atproto: {
    repo: {
      createRecord: { main: createRecord, $input: createRecordInput },
      getRecord: { main: getRecord },
      uploadBlob: { main: uploadBlob },
      applyWrites: {
        main: applyWrites,
        $input: applyWritesInput,
        create: applyWritesCreate,
        update: applyWritesUpdate,
        delete: applyWritesDelete,
        createResult: applyWritesCreateResult,
        updateResult: applyWritesUpdateResult,
        deleteResult: applyWritesDeleteResult,
      },
    },
  },
  example: {
    actor: {
      getPreferences: { main: getPreferences },
      putPreferences: { main: putPreferences, $input: putPreferencesInput },
      defs: { adultContentPref, contentLabelPref },
      profile,
    },
    feed: {
      post,
      generator,
    },
  },
}
