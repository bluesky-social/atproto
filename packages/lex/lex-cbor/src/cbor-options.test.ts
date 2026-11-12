import type { DecodeOptions, EncodeOptions, Token, Type } from 'cborg'
import type {
  DecodeTokenizer,
  MapSorter,
  OptionalTypeEncoder,
  QuickEncodeToken,
  Reference,
  TagDecoder,
  TokenOrNestedTokens,
} from 'cborg/interface'
import { expectTypeOf, it } from 'vitest'
import type { CborDecodeOptions, CborEncodeOptions } from './cbor-options.js'

type OwnedEncoder = NonNullable<CborEncodeOptions['typeEncoders']>[string]
type OwnedToken = Parameters<
  NonNullable<CborEncodeOptions['quickEncodeToken']>
>[0]

it('preserves the complete cborg option contract in both directions', () => {
  expectTypeOf<EncodeOptions>().not.toBeAny()
  expectTypeOf<DecodeOptions>().not.toBeAny()
  expectTypeOf<Token>().not.toBeAny()
  expectTypeOf<CborEncodeOptions>().toEqualTypeOf<EncodeOptions>()
  expectTypeOf<EncodeOptions>().toEqualTypeOf<CborEncodeOptions>()
  expectTypeOf<CborDecodeOptions>().toEqualTypeOf<DecodeOptions>()
  expectTypeOf<DecodeOptions>().toEqualTypeOf<CborDecodeOptions>()
  expectTypeOf<Parameters<QuickEncodeToken>[0]>().not.toBeAny()

  expectTypeOf<OwnedEncoder>().toExtend<OptionalTypeEncoder>()
  expectTypeOf<OptionalTypeEncoder>().toExtend<OwnedEncoder>()
  expectTypeOf<
    ReturnType<OwnedEncoder>
  >().toEqualTypeOf<TokenOrNestedTokens | null>()
  expectTypeOf<Parameters<OwnedEncoder>[3]>().toEqualTypeOf<
    Reference | undefined
  >()
  expectTypeOf<OwnedToken>().toEqualTypeOf<Token>()
  expectTypeOf<OwnedToken['type']>().toEqualTypeOf<Type>()
  expectTypeOf<CborEncodeOptions['mapSorter']>().toExtend<
    MapSorter | undefined
  >()
  expectTypeOf<MapSorter | undefined>().toExtend<
    CborEncodeOptions['mapSorter']
  >()
  expectTypeOf<CborEncodeOptions['quickEncodeToken']>().toExtend<
    QuickEncodeToken | undefined
  >()
  expectTypeOf<QuickEncodeToken | undefined>().toExtend<
    CborEncodeOptions['quickEncodeToken']
  >()
  expectTypeOf<CborDecodeOptions['tags']>().toEqualTypeOf<
    TagDecoder[] | undefined
  >()
  expectTypeOf<CborDecodeOptions['tokenizer']>().toExtend<
    DecodeTokenizer | undefined
  >()
  expectTypeOf<DecodeTokenizer | undefined>().toExtend<
    CborDecodeOptions['tokenizer']
  >()
})
