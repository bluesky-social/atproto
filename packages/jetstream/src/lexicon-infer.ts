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
import { CID } from 'multiformats/cid'

export type CoreDefinition =
  | LexPrimitive // LexBoolean | LexInteger | LexString | LexUnknown
  | LexIpldType // LexBytes | LexCidLink
  | LexRefVariant // LexRef | LexRefUnion
  | LexBlob
  | LexArray
  | LexPrimitiveArray
  | LexToken
  | LexObject

// Utilities

type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

// LexiconDoc definition extraction utilities

type ExtractRef<
  L extends readonly LexiconDoc[],
  R extends string,
> = R extends `${infer N}#${infer H}`
  ? {
      [K in keyof L]: L[K]['id'] extends N
        ? ExpandLocalRefs<L[K]['id'], L[K]['defs'][H]>
        : never
    }[number]
  : {
      [K in keyof L]: L[K]['id'] extends R
        ? ExpandLocalRefs<L[K]['id'], L[K]['defs']['main']>
        : never
    }[number]

type AsNamespacedRef<
  Ns extends string,
  R extends string,
> = R extends `#${infer H}` ? `${Ns}#${H}` : R

type ExpandLocalRefs<Ns extends string, D> =
  //
  D extends { type: 'ref'; ref: infer R extends string }
    ? { type: 'ref'; ref: AsNamespacedRef<Ns, R> }
    : D extends { type: 'union'; refs: (infer R extends string)[] }
      ? { type: 'union'; refs: AsNamespacedRef<Ns, R>[] }
      : D extends (infer T)[]
        ? ExpandLocalRefs<Ns, T>[]
        : D extends Record<string, unknown>
          ? { [K in keyof D]: ExpandLocalRefs<Ns, D[K]> }
          : D

type MainDef = LexXrpcProcedure | LexXrpcQuery | LexXrpcSubscription | LexRecord

export type ExtractIdentifiers<
  L extends readonly LexiconDoc[],
  Main extends MainDef = MainDef,
> = Extract<L[number], { defs: { main: Main } }>['id']

type ExtractMain<
  L extends readonly LexiconDoc[],
  Id extends L[number]['id'] = string,
  Main extends MainDef = MainDef,
> = Extract<L[number], { id: Id; defs: { main: Main } }>['defs']['main']

// Type inference utilities

type InferProperties<
  L extends readonly LexiconDoc[],
  P extends Record<string, CoreDefinition>,
  R,
> = R extends readonly (infer T extends string)[]
  ? Simplify<
      {
        -readonly [K in Exclude<keyof P, T>]?: InferLexCore<L, P[K]>
      } & {
        -readonly [K in Extract<keyof P, T>]-?: InferLexCore<L, P[K]>
      }
    >
  : {
      -readonly [K in keyof P]?: InferLexCore<L, P[K]>
    }

// Definitions type inference

type InferLexString<D extends LexString> = D extends {
  knownValues: (infer K)[]
}
  ? K
  : D extends { format: 'datetime' }
    ? `${string}-${string}-${string}T${string}:${string}:${string}${
        | ''
        | `.${string}`}Z`
    : D extends { format: 'did' }
      ? `did:${string}`
      : D extends { format: 'at-uri' }
        ? `at://${string}`
        : D extends { format: 'uri' }
          ? `${string}://${string}`
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
    ? CID
    : never

type InferLexBlob<D extends LexBlob> = {
  $type: 'blob'
  ref: CID
  mimeType: D extends { accept: readonly (infer A extends string)[] }
    ? A
    : string
  size: number
}

type InferLexRefVariant<
  L extends readonly LexiconDoc[],
  D extends LexRefVariant,
> = D extends { type: 'ref'; ref: infer R extends string }
  ? InferRef<L, R>
  : D extends { type: 'union'; refs: readonly (infer R extends string)[] }
    ? InferRef<L, R>
    : never

type InferLexObject<
  L extends readonly LexiconDoc[],
  D extends LexObject,
> = D extends {
  properties: infer P extends Record<string, CoreDefinition>
  required?: infer R
}
  ? InferProperties<L, P, R>
  : never

type InferLexArray<
  L extends readonly LexiconDoc[],
  D extends LexArray | LexPrimitiveArray,
> = D extends {
  items: infer I extends CoreDefinition
}
  ? InferLexCore<L, I>[]
  : never

type InferLexCore<
  L extends readonly LexiconDoc[],
  D extends CoreDefinition,
> = D extends LexRefVariant
  ? InferLexRefVariant<L, D>
  : D extends LexObject
    ? InferLexObject<L, D>
    : D extends LexArray | LexPrimitiveArray
      ? InferLexArray<L, D>
      : D extends LexPrimitive
        ? InferLexPrimitive<D>
        : D extends LexIpldType
          ? InferLexIpldType<D>
          : D extends LexBlob
            ? InferLexBlob<D>
            : D extends LexToken
              ? unknown
              : never

type InferLexRecord<
  L extends readonly LexiconDoc[],
  D extends LexRecord,
> = D extends { record: infer R extends CoreDefinition }
  ? InferLexCore<L, R>
  : never

export type InferXrpcParameters<
  L extends readonly LexiconDoc[],
  D extends LexXrpcParameters,
> = D extends {
  type: 'params'
  properties: infer P extends Record<string, CoreDefinition>
  required?: infer R
}
  ? InferProperties<L, P, R>
  : undefined | Record<string, never>

export type InferXrpcProcedureInput<
  L extends readonly LexiconDoc[],
  D extends LexXrpcProcedure,
> = D extends {
  input: {
    encoding: 'application/json'
    schema: infer S extends CoreDefinition
  }
}
  ? InferLexCore<L, S>
  : D extends { input: { encoding: '*/*' } }
    ? Uint8Array
    : unknown

export type InferXrpcProcedureOutput<
  L extends readonly LexiconDoc[],
  D extends LexXrpcProcedure,
> = D extends {
  output: {
    encoding: 'application/json'
    schema: infer S extends CoreDefinition
  }
}
  ? InferLexCore<L, S>
  : undefined

export type InferRef<
  L extends readonly LexiconDoc[],
  Id extends string,
> = InferLexCore<L, Extract<ExtractRef<L, Id>, CoreDefinition>>

export type ExtractXrpcMethodIds<L extends readonly LexiconDoc[]> =
  ExtractIdentifiers<L, LexXrpcProcedure | LexXrpcQuery | LexXrpcSubscription>

export type InferRecord<
  L extends readonly LexiconDoc[],
  Id extends ExtractIdentifiers<L, LexRecord> = ExtractIdentifiers<
    L,
    LexRecord
  >,
> = {
  [I in Id]: Simplify<
    { $type: I } & InferLexRecord<L, ExtractMain<L, I, LexRecord>>
  >
}[Id]
type LexXrpcParametrizedMethod = (
  | LexXrpcProcedure
  | LexXrpcQuery
  | LexXrpcSubscription
) & {
  parameters: LexXrpcParameters
}

export type InferParameters<
  L extends readonly LexiconDoc[],
  Id extends ExtractIdentifiers<
    L,
    LexXrpcParametrizedMethod
  > = ExtractIdentifiers<L, LexXrpcParametrizedMethod>,
> = InferXrpcParameters<
  L,
  ExtractMain<L, Id, LexXrpcParametrizedMethod>['parameters']
>

export type InferProcedureInput<
  L extends readonly LexiconDoc[],
  Id extends ExtractIdentifiers<L, LexXrpcProcedure> = ExtractIdentifiers<
    L,
    LexXrpcProcedure
  >,
> = InferXrpcProcedureInput<L, ExtractMain<L, Id, LexXrpcProcedure>>

export type InferProcedureOutput<
  L extends readonly LexiconDoc[],
  Id extends ExtractIdentifiers<L, LexXrpcProcedure> = ExtractIdentifiers<
    L,
    LexXrpcProcedure
  >,
> = InferXrpcProcedureOutput<L, ExtractMain<L, Id, LexXrpcProcedure>>
