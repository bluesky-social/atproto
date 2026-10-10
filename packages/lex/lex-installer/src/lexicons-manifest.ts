import { l } from '@atproto/lex-schema'
import { isRelativeFileUriString } from './fs.js'

export const directoryResolverSchema = l.object({
  type: l.literal('directory'),
  path: l.custom((val): val is `./${string}` | `../${string}` => {
    if (typeof val !== 'string') return false
    return val.startsWith('./') || val.startsWith('../')
  }, "Expected a relative path starting with './' or '../'"),
  include: l.optional(l.array(l.string())),
  exclude: l.optional(l.array(l.string())),
})

export const repoResolverSchema = l.object({
  type: l.literal('repo'),
  repo: l.string({ format: 'at-identifier' }),
  include: l.optional(l.array(l.string())),
  exclude: l.optional(l.array(l.string())),
})

export const lexiconResolverConfigSchema = l.discriminatedUnion('type', [
  directoryResolverSchema,
  repoResolverSchema,
])

export type LexiconResolverConfig = l.Infer<typeof lexiconResolverConfigSchema>

export const resolutionSchema = l.object({
  uri: l.union([
    // AT Protocol URI (network)
    l.string({ format: 'at-uri' }),
    // Relative file URI (local file)
    l.custom(isRelativeFileUriString, 'Expected a relative file:// URI'),
  ]),
  cid: l.string({ format: 'cid' }),
})

export type Resolution = l.Infer<typeof resolutionSchema>

export const lexiconsManifestV1Schema = l.object({
  version: l.literal(1),
  lexicons: l.array(l.string({ format: 'nsid' })),
  resolutions: l.dict(l.string({ format: 'nsid' }), resolutionSchema),
})

export type LexiconsManifestV1 = l.Infer<typeof lexiconsManifestV1Schema>

export const lexiconsManifestV2Schema = l.object({
  version: l.literal(2),
  lexicons: l.array(l.string({ format: 'nsid' })),
  resolvers: l.optional(l.array(lexiconResolverConfigSchema)),
  resolutions: l.dict(l.string({ format: 'nsid' }), resolutionSchema),
})

export type LexiconsManifestV2 = l.Infer<typeof lexiconsManifestV2Schema>

export const lexiconsManifestSchema = l.discriminatedUnion('version', [
  lexiconsManifestV1Schema,
  lexiconsManifestV2Schema,
])

export type LexiconsManifest = l.Infer<typeof lexiconsManifestSchema>

/**
 * Normalizes a lexicons manifest for consistent storage and comparison. Returns
 * a copy of the manifest with normalized structure.
 *
 * This function:
 * - Sorts the `lexicons` array alphabetically
 * - Sorts the `resolutions` object entries by key
 * - Preserves the `resolvers` array as authored (its order is significant)
 * - Validates the result against the schema
 *
 * Normalization ensures that manifests with the same content produce identical
 * JSON output, making them suitable for version control and comparison.
 *
 * @param input - The manifest to normalize
 * @returns A new normalized manifest object
 */
export function normalizeManifest(
  input?: LexiconsManifestV1 | LexiconsManifestV2,
): LexiconsManifestV2 {
  const resolvers =
    input?.version === 2 && input.resolvers != null
      ? structuredClone(
          // @NOTE `resolvers` is priority-ordered (order matters). We do can ignore any
          // resolvers that have an empty `include` array, as they would have no effect.
          input.resolvers.filter(
            (c) => c.include == null || c.include.length > 0,
          ),
        )
      : []
  const lexicons = input?.lexicons.toSorted() ?? []
  const resolutions = Object.fromEntries(
    Object.entries(input?.resolutions ?? {})
      .sort(compareObjectEntriesFn)
      .map(([k, { uri, cid }]) => [k, { uri, cid }]),
  )

  // @NOTE Parsing is not strictly necessary here, but it ensures the output
  // conforms to the schema.
  return lexiconsManifestV2Schema.parse({
    version: 2,
    resolvers: resolvers?.length ? resolvers : undefined,
    lexicons,
    resolutions,
  })
}

function compareObjectEntriesFn(
  a: [string, unknown],
  b: [string, unknown],
): number {
  return a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0
}
