import { l } from '@atproto/lex-schema'

export const lexiconsManifestSchema = l.object(
  {
    version: l.literal(1),
    lexicons: l.array(l.string({ format: 'nsid' })),
    resolutions: l.dict(
      l.string({ format: 'nsid' }),
      l.object(
        {
          cid: l.string({ format: 'cid' }),
          uri: l.string({ format: 'at-uri' }),
        },
        {
          required: ['cid', 'uri'],
        },
      ),
    ),
  },
  { required: ['version', 'lexicons', 'resolutions'] },
)

export type LexiconsManifest = l.Infer<typeof lexiconsManifestSchema>
