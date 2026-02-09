import { l } from '@atproto/lex-schema'

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
  /** Map of NSID to resolution info (AT URI and CID) for all installed lexicons */
  resolutions: l.dict(
    l.string({ format: 'nsid' }),
    l.object({
      /** AT URI where the lexicon was fetched from */
      uri: l.string({ format: 'at-uri' }),
      /** Content identifier (CID) of the lexicon document */
      cid: l.string({ format: 'cid' }),
    }),
  ),
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
