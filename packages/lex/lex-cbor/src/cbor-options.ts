/**
 * Adapted from cborg 4.5.8's interface and token declarations.
 * Copyright 2020 Rod Vagg
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @NOTE Own this structural boundary so public declarations do not pull in
// cborg's extensionless type imports, which fail strict NodeNext library checks.

/** Configuration accepted by the CBOR encoder. */
export interface CborEncodeOptions {
  float64?: boolean
  addBreakTokens?: boolean
  mapSorter?: MapSorter
  quickEncodeToken?: QuickEncodeToken
  typeEncoders?: { [typeName: string]: OptionalTypeEncoder }
  /** Ignore plain object properties whose values are undefined. */
  ignoreUndefinedProperties?: boolean
}

/** Configuration accepted by the CBOR decoder. */
export interface CborDecodeOptions {
  allowIndefinite?: boolean
  allowUndefined?: boolean
  coerceUndefinedToNull?: boolean
  allowInfinity?: boolean
  allowNaN?: boolean
  allowBigInt?: boolean
  strict?: boolean
  useMaps?: boolean
  rejectDuplicateMapKeys?: boolean
  retainStringBytes?: boolean
  tags?: TagDecoder[]
  tokenizer?: DecodeTokenizer
}

interface TokenType {
  major: number
  majorEncoded: number
  name: string
  terminal: boolean
  toString(): string
  compare(typ: TokenType): number
}

interface Token {
  type: TokenType
  value: any
  encodedLength: number | undefined
  encodedBytes: Uint8Array | undefined
  byteValue: Uint8Array | undefined
  toString(): string
}

type TokenOrNestedTokens = Token | Token[] | TokenOrNestedTokens[]

interface Reference {
  parent: Reference | undefined
  obj: object | any[]
  includes(obj: object | any[]): boolean
}

type OptionalTypeEncoder = (
  data: any,
  typ: string,
  options: CborEncodeOptions,
  refStack?: Reference,
) => TokenOrNestedTokens | null

type MapSorter = (e1: (Token | Token[])[], e2: (Token | Token[])[]) => number
type QuickEncodeToken = (token: Token) => Uint8Array | undefined

type TagDecoder = (inner: any) => any

interface DecodeTokenizer {
  done(): boolean
  next(): Token
  pos(): number
}
