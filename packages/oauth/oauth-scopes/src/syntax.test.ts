import { ParsedResourceScope, isScopeForResource } from './syntax.js'

describe('isScopeForResource', () => {
  describe('exact match', () => {
    it('should return true for exact match', () => {
      expect(isScopeForResource('resource', 'resource')).toBe(true)
    })

    it('should return false for different resource', () => {
      expect(isScopeForResource('resource', 'differentResource')).toBe(false)
    })
  })

  describe('with positional parameter', () => {
    it('should return true for exact match with positional parameter', () => {
      expect(isScopeForResource('resource:positional', 'resource')).toBe(true)
    })

    it('should return false for different resource with positional parameter', () => {
      expect(
        isScopeForResource('differentResource:positional', 'resource'),
      ).toBe(false)
    })
  })

  describe('with named parameters', () => {
    it('should return true for exact match with named parameters', () => {
      expect(isScopeForResource('resource?param=value', 'resource')).toBe(true)
    })

    it('should return false for different resource with named parameters', () => {
      expect(
        isScopeForResource('differentResource?param=value', 'resource'),
      ).toBe(false)
    })
  })
})

const TEST_CASES: Array<{
  scope: string
  content: {
    resource: string
    positional?: string
    params?: Record<string, string[]>
  }
}> = [
  {
    scope: 'my-res',
    content: { resource: 'my-res' },
  },
  {
    scope: 'my-res:my-pos',
    content: { resource: 'my-res', positional: 'my-pos' },
  },
  {
    scope: 'my-res:',
    content: { resource: 'my-res', positional: '' },
  },
  {
    scope: 'my-res?x=value&y=value-y',
    content: { resource: 'my-res', params: { x: ['value'], y: ['value-y'] } },
  },
  {
    scope: 'my-res?x=foo&x=bar&x=baz',
    content: { resource: 'my-res', params: { x: ['foo', 'bar', 'baz'] } },
  },
]

for (const { scope, content } of TEST_CASES) {
  describe(scope, () => {
    const parsed = ParsedResourceScope.fromString(scope)

    it(`should stringify ${scope} correctly`, () => {
      expect(parsed.toString()).toBe(scope)
    })

    it(`should parse ${scope} correctly`, () => {
      expect(parsed.toJSON()).toMatchObject(content)
    })

    it(`should match ${scope} resource`, () => {
      expect(parsed.is(content.resource)).toBe(true)
    })

    it(`should return undefined for nonexistent single-value param`, () => {
      expect(parsed.getSingle('nonexistent')).toBeUndefined()
    })

    it(`should return undefined for nonexistent multi-value param`, () => {
      expect(parsed.getMulti('nonexistent')).toBeUndefined()
    })

    const { params } = content
    if (params) {
      it(`should allow detecting unknown params`, () => {
        const allowedParams = Object.keys(params) as [string, ...string[]]
        expect(parsed.containsParamsOtherThan(allowedParams)).toBe(false)

        if (allowedParams.length > 1) {
          const woFirst = allowedParams.slice(1) as [string, ...string[]]
          expect(parsed.containsParamsOtherThan(woFirst)).toBe(true)

          const woLast = allowedParams.slice(0, -1) as [string, ...string[]]
          expect(parsed.containsParamsOtherThan(woLast)).toBe(true)
        }
      })

      for (const [key, values] of Object.entries(params)) {
        it(`should get an array when reading "${key}"`, () => {
          expect(parsed.getMulti(key)).toEqual(values)
          expect(parsed.getMulti(key, true)).toEqual(values)
        })

        if (values.length === 1) {
          it(`should allow retrieving single-value params`, () => {
            expect(parsed.getSingle(key)).toEqual(values[0])
            expect(parsed.getSingle(key, true)).toEqual(values[0])
          })
        } else {
          it(`should return null for multi-value params`, () => {
            expect(parsed.getSingle(key)).toBeNull()
            expect(parsed.getSingle(key, true)).toBeNull()
          })
        }
      }
    }

    const { positional } = content
    if (positional !== undefined) {
      it(`should return positional parameter`, () => {
        expect(parsed.positional).toBe(positional)
      })

      it(`should return positional parameter when reading as single-value`, () => {
        expect(parsed.getSingle('nonexistent', true)).toBe(positional)
      })

      it(`should return positional parameter when reading as multi-value`, () => {
        expect(parsed.getMulti('nonexistent', true)).toEqual([positional])
      })
    }
  })
}

describe('invalid positional parameters', () => {
  it('should return null for positional parameters used together with named parameters', () => {
    const parsed = ParsedResourceScope.fromString('my-res:pos?x=value')
    expect(parsed.getSingle('x', true)).toBeNull()
    expect(parsed.getMulti('x', true)).toBeNull()
  })
})

describe('containsParamsOtherThan', () => {
  it('should return true if there are additional params', () => {
    const parsed = ParsedResourceScope.fromString('my-res?x=value&y=value-y')
    expect(parsed.containsParamsOtherThan(['x'])).toBe(true)
  })
})

describe('url encoding', () => {
  it('should handle URL encoding in positional parameters', () => {
    const parsed = ParsedResourceScope.fromString('my-res:my%20pos')
    expect(parsed.positional).toBe('my pos')
  })

  it('should handle URL encoding in named parameters', () => {
    const parsed = ParsedResourceScope.fromString('my-res?x=my%20value')
    expect(parsed.getSingle('x')).toBe('my value')
  })

  it(`should allow colon (:) in positional parameters`, () => {
    const parsed = ParsedResourceScope.fromString('my-res:my:pos')
    expect(parsed.positional).toBe('my:pos')
  })
})
