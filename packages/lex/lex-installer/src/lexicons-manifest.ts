import { l } from '@atproto/lex-schema'

export const lexiconsManifestSchema = l.object(
  {
    lexicons: l.dict(
      l.string({ format: 'nsid' }),
      l.union([l.string({ format: 'cid' }), l.string({ format: 'uri' })]),
    ),
  },
  { required: ['lexicons'] },
)

export type LexiconsManifest = l.Infer<typeof lexiconsManifestSchema>
