// Checked by tsconfig.consumer.json: imports @atproto/lex by package name so
// that the built declarations (and everything they reach) are type-checked.

import {
  type Client,
  type LexValue,
  cborDecode,
  cborEncode,
  l,
  walk,
} from '@atproto/lex'

const schema = l.object({ text: l.string(), count: l.integer() })

export const parsed: { text: string; count: number } = schema.parse({
  text: 'hello',
  count: 42,
})
export const decoded: LexValue = cborDecode(cborEncode(parsed))
export const schemas: unknown[] = [...walk({ schema })]
export type { Client }
