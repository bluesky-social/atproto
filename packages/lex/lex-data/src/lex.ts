import { CID } from './cid.js'

export type LexScalar = number | string | boolean | null | CID | Uint8Array
export type Lex = LexScalar | Lex[] | { [_ in string]?: Lex }
export type LexMap = { [_ in string]?: Lex }
export type LexArray = Lex[]
