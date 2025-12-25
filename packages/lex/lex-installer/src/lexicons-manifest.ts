import { l } from '@atproto/lex-schema'

export const lexiconsManifestSchema = l.object({
  version: l.literal(1),
  lexicons: l.array(l.string({ format: 'nsid' })),
  resolutions: l.dict(
    l.string({ format: 'nsid' }),
    l.object({
      uri: l.string({ format: 'at-uri' }),
      cid: l.string({ format: 'cid' }),
    }),
  ),
})

export type LexiconsManifest = l.Infer<typeof lexiconsManifestSchema>

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
