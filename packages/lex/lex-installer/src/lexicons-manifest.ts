import { l } from '@atproto/lex-schema'

export const fileUriStringSchema = l.custom(
  (val): val is `file://${string}` => {
    const url = typeof val === 'string' ? new URL(val) : null
    return url?.protocol === 'file:'
  },
  "Expected a file URI starting with 'file://'",
)

export type FileUriString = l.Infer<typeof fileUriStringSchema>

export const directoryResolverSchema = l.object({
  /** Resolve lexicons from a local directory laid out by NSID. */
  type: l.literal('directory'),
  /** Directory path, relative to this manifest file. */
  path: l.custom((val): val is `./${string}` | `../${string}` => {
    if (typeof val !== 'string') return false
    return val.startsWith('./') || val.startsWith('../')
  }, "Expected a relative path starting with './' or '../'"),
  /**
   * NSID glob patterns to restrict this resolver to (defaults to all). Patterns
   * support `*` as a wildcard (e.g. `app.bsky.*`).
   */
  include: l.optional(l.array(l.string())),
  /** NSID glob patterns this resolver must never answer for (supports `*`). */
  exclude: l.optional(l.array(l.string())),
})

/**
 * A local override strategy for resolving dependency lexicons. Resolvers are
 * ordered by priority (first match wins); the network is always the implicit
 * final fallback.
 */
export const lexiconResolverConfigSchema = l.discriminatedUnion('type', [
  directoryResolverSchema,
  // @TODO Add a `{ type: 'repo', ... }` resolver that resolves lexicons from
  // one or more specific repositories (DIDs) instead of the default DNS-based
  // discovery.
])

/** A single entry of the manifest's `resolvers` array. */
export type LexiconResolverConfig = l.Infer<typeof lexiconResolverConfigSchema>

export const resolutionSchema = l.object({
  /**
   * Where the lexicon was resolved from: an `at://` URI (network) or a
   * `file://` URI (local file, relative to this manifest).
   */
  uri: l.union([l.string({ format: 'at-uri' }), fileUriStringSchema]),
  /** Content identifier (CID) of the lexicon document */
  cid: l.string({ format: 'cid' }),
})

export type Resolution = l.Infer<typeof resolutionSchema>

/**
 * Schema for validating and parsing lexicons manifest files.
 *
 * The manifest tracks which lexicons are installed and how they were resolved.
 * This schema ensures the manifest file conforms to the expected structure.
 */
export const lexiconsManifestSchema = l.object({
  /** Schema version, currently always 1 */
  version: l.literal(1),
  /** Array of NSID strings for directly requested lexicons */
  lexicons: l.array(l.string({ format: 'nsid' })),
  /**
   * Ordered list of local override strategies for resolving dependency
   * lexicons. Consulted (in order) before the network fallback.
   */
  resolvers: l.optional(l.array(lexiconResolverConfigSchema)),
  /** Map of NSID to resolution info (URI and CID) for all installed lexicons */
  resolutions: l.dict(l.string({ format: 'nsid' }), resolutionSchema),
})

/**
 * Type representing a parsed lexicons manifest.
 */
export type LexiconsManifest = l.Infer<typeof lexiconsManifestSchema>

/**
 * Normalizes a lexicons manifest for consistent storage and comparison.
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
 * @param manifest - The manifest to normalize
 * @returns A new normalized manifest object
 */
export function normalizeLexiconsManifest(
  manifest: LexiconsManifest,
): LexiconsManifest {
  const normalized: LexiconsManifest = {
    version: manifest.version,
    lexicons: [...manifest.lexicons].sort(),
    // `resolvers` is priority-ordered, so it is preserved as-is (not sorted).
    ...(manifest.resolvers?.length ? { resolvers: manifest.resolvers } : {}),
    resolutions: Object.fromEntries(
      Object.entries(manifest.resolutions)
        .sort(compareObjectEntriesFn)
        .map(([k, { uri, cid }]) => [k, { uri, cid }]),
    ),
  }
  // For good measure:
  return lexiconsManifestSchema.parse(normalized)
}

function compareObjectEntriesFn(
  a: [string, unknown],
  b: [string, unknown],
): number {
  return a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0
}
