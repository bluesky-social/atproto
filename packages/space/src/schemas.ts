import { z } from 'zod'
import {
  type DidString,
  type SpaceRefString,
  isSpaceRefString,
  isValidDid,
  isValidTid,
} from '@atproto/syntax'
import {
  REPO_STAR_TYPE,
  SPACE_META_STAR_TYPE,
  SPACE_META_VERSION,
} from './constants.js'

// @NOTE Every zod schema is implemented in this file, which is **not** part of
// the public interface of this package (no re-export from this file). This
// allows "zod" not to be included in the public API of this package. Instead,
// schemas are exposed through the `Def` interface (see "./types.js"), using
// `buildDef('<name>', zodSchema)`, which TypeScript compiles by inference.

// @TODO Replace "zod" by either @atproto/lex-schema or, a custom implementation
// to reduce this package's footprint.

const bytesSchema = z.instanceof(Uint8Array<ArrayBufferLike>)
const tidSchema = z.string().refine(isValidTid, 'must be a TID')
const didSchema = z.custom<DidString>(isValidDid)
const spaceRefSchema = z.custom<SpaceRefString>(isSpaceRefString)

export const repoStarMetaSchema = z.object({
  $type: z.literal(REPO_STAR_TYPE),
  ver: z.number(),
  repo: didSchema,
  space: spaceRefSchema,
  rev: z.string(),
  data: bytesSchema,
})

export const spaceMetaStarMetaSchema = z.object({
  $type: z.literal(SPACE_META_STAR_TYPE),
  ver: z.literal(SPACE_META_VERSION),
  space: spaceRefSchema,
})

export const spaceMetaWriterSchema = z.object({
  rev: tidSchema,
  data: bytesSchema,
  spaceRev: tidSchema,
})
