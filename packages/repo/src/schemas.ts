import { z } from 'zod'
import { type Cid, isCid } from '@atproto/lex-data'

// @NOTE Every zod schema is implemented in this file, which is **not** part of
// the public interface of this package (no re-export from this file). This
// allows "zod" not to be included in the public API of this package. Instead,
// schemas are exposed through @atproto/common-web's check.Def interface by
// exposing the zod schemas through `check.buildDef('<name>', zodSchema)`, which
// TypeScript compiles by inference.

// @TODO Replace "zod" by either @atproto/lex-schema or, a custom implementation
// to reduce this package's footprint.

export const cidSchema = z.custom<Cid>(
  // @TODO "flavor" should be set to "cbor", abd tge custom generic should be
  // CborCid. This breaks this (and dependent) package's type expectations.
  (input) => isCid(input, { flavor: undefined }),
  {
    message: 'Not a valid CID',
  },
)
export const bytesSchema = z.instanceof(Uint8Array<ArrayBufferLike>)
export const stringSchema = z.string()
export const mapSchema = z.record(z.string(), z.unknown())

export const unknownSchema = z.unknown()

export const commitSchema = z.object({
  did: stringSchema,
  version: z.literal(3),
  data: cidSchema,
  rev: stringSchema,
  prev: cidSchema.nullable(),
  sig: bytesSchema,
})

export const legacyV2CommitSchema = z.object({
  did: stringSchema,
  version: z.literal(2),
  data: cidSchema,
  rev: stringSchema.optional(),
  prev: cidSchema.nullable(),
  sig: bytesSchema,
})

export const versionedCommitSchema = z.discriminatedUnion('version', [
  commitSchema,
  legacyV2CommitSchema,
])

export const carHeaderSchema = z.object({
  version: z.literal(1),
  roots: z.array(cidSchema),
})

const subTreePointerSchema = z.nullable(cidSchema)
const treeEntrySchema = z.object({
  p: z.number(), // prefix count of ascii chars that this key shares with the prev key
  k: bytesSchema, // the rest of the key outside the shared prefix
  v: cidSchema, // value
  t: subTreePointerSchema, // next subtree (to the right of leaf)
})
export const nodeDataSchema = z.object({
  l: subTreePointerSchema, // left-most subtree
  e: z.array(treeEntrySchema), //entries
})
