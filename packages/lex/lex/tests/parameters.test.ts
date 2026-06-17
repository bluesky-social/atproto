import { describe, expect, expectTypeOf, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('com.example.parametersEnum', () => {
  it('Passes valid parameters', () => {
    const paramResult = com.example.parametersEnum.$params.fromURLSearchParams([
      ['booleanCst', 'true'],
      ['integerCst', '42'],
      ['integerEnum', '2'],
      ['stringCst', 'foo'],
      ['stringEnum', 'bar'],
      ['arrayFalse', 'false'],
      ['arrayFalse', 'false'],
      ['arrayFalse', 'false'],
      ['arrayIntCst', '42'],
      ['arrayIntEnum', '5'],
    ])
    expect(paramResult).toStrictEqual({
      booleanCst: true,
      integerCst: 42,
      integerEnum: 2,
      stringCst: 'foo',
      stringEnum: 'bar',
      arrayFalse: [false, false, false],
      arrayIntCst: [42],
      arrayIntEnum: [5],
    })
  })

  it('properly types params', () => {
    expectTypeOf<com.example.parametersEnum.$Params>().toMatchObjectType<{
      booleanCst: true
      integerCst: 42
      integerEnum?: 1 | 2 | 3
      stringCst?: 'foo'
      stringEnum?: 'foo' | 'bar' | 'baz'
      arrayFalse?: false[]
      arrayIntCst?: 42[]
      arrayIntEnum?: (4 | 5 | 6)[]
    }>()
  })
})
