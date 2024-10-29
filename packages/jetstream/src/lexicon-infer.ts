// @TODO move this in @atproto/lexicon ?

import {
  LexArray,
  LexBlob,
  LexBoolean,
  LexBytes,
  LexCidLink,
  LexiconDoc,
  LexInteger,
  LexIpldType,
  LexObject,
  LexPrimitive,
  LexPrimitiveArray,
  LexRecord,
  LexRefVariant,
  LexString,
  LexToken,
  LexUnknown,
  LexXrpcParameters,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexXrpcSubscription,
} from '@atproto/lexicon'

export type LexDef =
  | LexPrimitive // LexBoolean | LexInteger | LexString | LexUnknown
  | LexIpldType // LexBytes | LexCidLink
  | LexRefVariant // LexRef | LexRefUnion
  | LexBlob
  | LexArray
  | LexPrimitiveArray
  | LexToken
  | LexObject
  | LexRecord

export type MainDef =
  | LexXrpcProcedure
  | LexXrpcQuery
  | LexXrpcSubscription
  | LexRecord

export type Cid = string
export type Did = `did:${string}`
export type Uri = `${string}://${string}`
export type AtUri = `at://${string}`
export type Datetime =
  `${number}-${number}-${number}T${number}:${number}:${number}${
    | ''
    | `.${number}`}Z`

declare global {
  interface Date {
    // Allows using date.toISOString() as a Datetime
    toISOString(): `${number}-${number}-${number}T${number}:${number}:${number}.${number}Z`
  }
}

// Utilities

type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

declare const failure: unique symbol
type Failure<Message extends string> = { [failure]: Message }

// LexiconDoc definition extraction utilities

type Ref = string

export type ExtractRefs<L extends readonly LexiconDoc[]> = {
  [I in L[number]['id']]: {
    [H in keyof ExtractDefs<L, I>]: H extends string ? `${I}#${H}` : never
  }[keyof ExtractDefs<L, I>]
}[L[number]['id']]

type ExtractDefs<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
> = Extract<L[number], { id: C }>['defs']

type ExtractDef<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  M extends string,
> = Extract<L[number], { id: C; defs: Record<M, LexDef> }>['defs'][M]

export type ExtractId<
  L extends readonly LexiconDoc[],
  Main extends MainDef = MainDef,
> = Extract<L[number], { defs: { main: Main } }>['id']

type ExtractMain<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  Main extends MainDef = MainDef,
> = Extract<L[number], { defs: { main: Main }; id: C }>['defs']['main']

// Type inference utilities

type InferProperties<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  P extends Record<string, LexDef>,
  R,
> = R extends readonly (infer T extends string)[]
  ? Simplify<
      {
        -readonly [K in Exclude<keyof P, T>]?: InferDef<L, C, P[K]>
      } & {
        -readonly [K in Extract<keyof P, T>]-?: InferDef<L, C, P[K]>
      }
    >
  : {
      -readonly [K in keyof P]?: InferDef<L, C, P[K]>
    }

// Definitions type inference

type InferLexString<D extends LexString> = D extends {
  knownValues: readonly (infer K extends string)[]
}
  ? K
  : D extends { format: 'datetime' }
    ? Datetime
    : D extends { format: 'did' }
      ? Did
      : D extends { format: 'at-uri' }
        ? AtUri
        : D extends { format: 'uri' }
          ? Uri
          : // @TODO: other formats ?
            string

type InferLexPrimitive<D extends LexPrimitive> = D extends LexString
  ? InferLexString<D>
  : D extends LexInteger
    ? number
    : D extends LexBoolean
      ? boolean
      : D extends LexUnknown
        ? unknown
        : never

type InferLexIpldType<D extends LexIpldType> = D extends LexBytes
  ? Uint8Array
  : D extends LexCidLink
    ? Cid
    : never

type InferLexBlob<D extends LexBlob> = Simplify<{
  $type: 'blob'
  ref: string
  mimeType: D extends { accept: readonly (infer A extends string)[] }
    ? A
    : string
  size: number
}>

type InferLexObject<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  D extends {
    properties: Record<string, LexDef>
    required?: readonly string[]
  },
> = InferProperties<L, C, D['properties'], D['required']>

type InferLexArray<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  D extends { items: LexDef },
> = InferDef<L, C, D['items']>[] & NonNullable<unknown>

type InferLexRecord<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  D extends { record: LexObject },
> = InferLexObject<L, C, D['record']>

type InferLexRefVariant<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  D extends LexRefVariant,
> = D extends { type: 'ref'; ref: infer R extends Ref }
  ? InferRef<L, C, R>
  : D extends { type: 'union'; refs: readonly (infer R extends Ref)[] }
    ? InferRef<L, C, R>
    : never

type InferRef<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  R extends Ref,
> = R extends `lex:${infer N}#${infer H}`
  ? InferDef<L, N, ExtractDef<L, N, H>>
  : R extends `lex:${infer N}`
    ? InferDef<L, N, ExtractDef<L, N, 'main'>>
    : R extends `#${infer H}`
      ? InferDef<L, C, ExtractDef<L, C, H>>
      : R extends `${infer N}#${infer H}`
        ? InferDef<L, N, ExtractDef<L, N, H>>
        : R extends `${string}.${string}`
          ? InferDef<L, R, ExtractDef<L, R, 'main'>>
          : Failure<"ref must be in the form 'lex:<nsid>#<def>', 'lex:<nsid>', '<nsid>#<def>', '#<def>'. or '<nsid>'.">

type InferDef<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  D extends LexDef,
> =
  // Lexicon validator does not allow nested records.
  // D extends LexRecord ? InferLexRecord<L, C, D> :
  D extends LexRefVariant
    ? InferLexRefVariant<L, C, D>
    : D extends LexObject
      ? InferLexObject<L, C, D>
      : D extends LexArray | LexPrimitiveArray
        ? InferLexArray<L, C, D>
        : D extends LexPrimitive
          ? InferLexPrimitive<D>
          : D extends LexIpldType
            ? InferLexIpldType<D>
            : D extends LexBlob
              ? InferLexBlob<D>
              : D extends LexToken
                ? unknown
                : never

/**
 * Infer a particular type from a lexicon, using a reference to a definition.
 * Only supports inferring type of records and core types. Use
 * {@link InferParams}, {@link InferInput}, {@link InferOutput} for Xrpc types.
 */
export type Infer<
  L extends readonly LexiconDoc[],
  R extends ExtractRefs<L>,
> = InferRef<L, never, R>

//- Record extraction

export type RecordId<L extends readonly LexiconDoc[]> = ExtractId<L, LexRecord>

export type InferRecord<
  L extends readonly LexiconDoc[],
  Id extends RecordId<L>,
> = {
  [I in Id]: InferLexRecord<L, I, ExtractMain<L, I, LexRecord>> & {
    $type: I
    // Records can contain additional properties
    [k: string]: unknown
  }
}[Id]

//- Xrpc extraction

export type ProcedureId<L extends readonly LexiconDoc[]> = ExtractId<
  L,
  LexXrpcProcedure
>

export type QueryId<L extends readonly LexiconDoc[]> = ExtractId<
  L,
  LexXrpcQuery
>

export type SubscriptionId<L extends readonly LexiconDoc[]> = ExtractId<
  L,
  LexXrpcSubscription
>

//- Xrpc type inference

type InferXrpcParameters<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  D extends LexXrpcParameters,
> = D extends {
  type: 'params'
  properties: infer P extends Record<string, LexDef>
  required?: infer R
}
  ? InferProperties<L, C, P, R>
  : undefined | Record<string, never>

type InferXrpcProcedureInput<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  D extends LexXrpcProcedure,
> = D extends {
  input: {
    encoding: 'application/json'
    schema: infer S extends LexDef
  }
}
  ? InferDef<L, C, S>
  : D extends { input: { encoding: '*/*' } }
    ? Uint8Array
    : unknown

type InferXrpcProcedureOutput<
  L extends readonly LexiconDoc[],
  C extends L[number]['id'],
  D extends LexXrpcProcedure | LexXrpcQuery,
> = D extends {
  output: {
    encoding: 'application/json'
    schema: infer S extends LexDef
  }
}
  ? InferDef<L, C, S>
  : D extends { output: { encoding: '*/*' } }
    ? Uint8Array
    : undefined

export type InferParams<
  L extends readonly LexiconDoc[],
  Id extends ProcedureId<L> | QueryId<L> | SubscriptionId<L>,
> = {
  [I in Id]: InferXrpcParameters<
    L,
    I,
    ExtractMain<
      L,
      I,
      (LexXrpcProcedure | LexXrpcQuery | LexXrpcSubscription) & {
        parameters: LexXrpcParameters
      }
    >['parameters']
  >
}[Id]

export type InferInput<
  L extends readonly LexiconDoc[],
  Id extends ProcedureId<L>,
> = {
  [I in Id]: InferXrpcProcedureInput<L, I, ExtractMain<L, I, LexXrpcProcedure>>
}[Id]

export type InferOutput<
  L extends readonly LexiconDoc[],
  Id extends ProcedureId<L> | QueryId<L>,
> = {
  [I in Id]: InferXrpcProcedureOutput<
    L,
    I,
    ExtractMain<L, I, LexXrpcProcedure | LexXrpcQuery>
  >
}[Id]

export type InferMethodContext<
  L extends readonly LexiconDoc[],
  Id extends ProcedureId<L> | QueryId<L>,
> = {
  [I in Id]: {
    params: InferParams<L, I>
  } & (I extends ProcedureId<L>
    ? { input: InferInput<L, I> }
    : { input?: undefined })
}[Id]

export type InferMethod<
  L extends readonly LexiconDoc[],
  Id extends ProcedureId<L> | QueryId<L>,
> = {
  [I in Id]: (ctx: InferMethodContext<L, I>) => Promise<InferOutput<L, I>>
}[Id]
