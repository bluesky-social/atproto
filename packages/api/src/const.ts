import * as com from '@atproto/lex/com'
import { l } from '@atproto/lex/lex'

export const BSKY_LABELER_DID = 'did:plc:ar7c4by46qjdydhdevvrndac'

export const foo = l.object({
  bar: com.atproto.repo.defs.commitMeta,
})

export type Foo = l.Infer<typeof foo>
