import { l } from '@atproto/lex-schema'

export const lexiconsLockSchema = l.object(
  {
    lexicons: l.dict(
      l.string({ format: 'nsid' }),
      l.union([l.string({ format: 'cid' }), l.string({ format: 'uri' })]),
    ),
    resolutions: l.dict(
      l.string({ format: 'nsid' }),
      l.object(
        {
          cid: l.string({ format: 'cid' }),
          uri: l.union([
            l.string({ format: 'at-uri' }),
            l.string({ format: 'uri' }),
          ]),
          dependencies: l.array(l.string({ format: 'nsid' })),
        },
        {
          required: ['cid', 'uri'],
        },
      ),
    ),
  },
  { required: ['lexicons'] },
)

export type LexiconsLock = l.Infer<typeof lexiconsLockSchema>
