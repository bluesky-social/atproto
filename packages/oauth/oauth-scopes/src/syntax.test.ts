import { ResourceSyntax, isScopeForResource } from './syntax.js'

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

for (const { scope, normalized = scope, content } of [
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
    scope: 'my-res:foo?x=value&y=value-y',
    content: {
      resource: 'my-res',
      positional: 'foo',
      params: { x: ['value'], y: ['value-y'] },
    },
  },
  {
    scope: 'my-res?x=value&y=value-y',
    content: { resource: 'my-res', params: { x: ['value'], y: ['value-y'] } },
  },
  {
    scope: 'my-res?x=foo&x=bar&x=baz',
    content: { resource: 'my-res', params: { x: ['foo', 'bar', 'baz'] } },
  },
  {
    scope: 'rpc:foo.bar?aud=did:foo:bar?lxm=bar.baz',
    normalized: 'rpc:foo.bar?aud=did:foo:bar%3Flxm%3Dbar.baz',
    content: {
      resource: 'rpc',
      positional: 'foo.bar',
      params: { aud: ['did:foo:bar?lxm=bar.baz'] },
    },
  },
] as Array<{
  scope: string
  normalized?: string
  content: {
    resource: string
    positional?: string
    params?: Record<string, string[]>
  }
}>) {
  describe(`Valid "${scope}"`, () => {
    const syntax = ResourceSyntax.fromString(scope)

    it('should match the expected syntax', () => {
      expect(syntax).toEqual({
        resource: content.resource,
        positional: content.positional,
        params: content.params
          ? new URLSearchParams(
              Object.entries(content.params).flatMap(([k, v]) =>
                v.map((val) => [k, val]),
              ),
            )
          : undefined,
      })
    })

    it(`should stringify ${scope} correctly`, () => {
      expect(syntax.toString()).toBe(normalized)
    })

    it(`should parse ${scope} correctly`, () => {
      expect(syntax.toJSON()).toMatchObject(content)
    })

    it(`should match ${scope} resource`, () => {
      expect(syntax.is(content.resource)).toBe(true)
    })

    it(`should return undefined for nonexistent single-value param`, () => {
      expect(syntax.getSingle('nonexistent')).toBeUndefined()
    })

    it(`should return undefined for nonexistent multi-value param`, () => {
      expect(syntax.getMulti('nonexistent')).toBeUndefined()
    })

    const { params } = content
    if (params) {
      it(`should allow detecting unknown params`, () => {
        const allowedParams = Object.keys(params) as [string, ...string[]]
        expect(syntax.containsParamsOtherThan(allowedParams)).toBe(false)

        if (allowedParams.length > 1) {
          const woFirst = allowedParams.slice(1) as [string, ...string[]]
          expect(syntax.containsParamsOtherThan(woFirst)).toBe(true)

          const woLast = allowedParams.slice(0, -1) as [string, ...string[]]
          expect(syntax.containsParamsOtherThan(woLast)).toBe(true)
        }
      })

      for (const [key, values] of Object.entries(params)) {
        it(`should get an array when reading "${key}"`, () => {
          expect(syntax.getMulti(key)).toEqual(values)
        })

        if (values.length === 1) {
          it(`should allow retrieving single-value params`, () => {
            expect(syntax.getSingle(key)).toEqual(values[0])
          })
        } else {
          it(`should return null for multi-value params`, () => {
            expect(syntax.getSingle(key)).toBeNull()
            expect(syntax.getSingle(key, true)).toBeNull()
          })
        }
      }
    }

    const { positional } = content
    if (positional !== undefined) {
      it(`should return positional parameter`, () => {
        expect(syntax.positional).toBe(positional)
      })

      it(`should return positional parameter when reading as single-value`, () => {
        expect(syntax.getSingle('nonexistent', true)).toBe(positional)
      })

      it(`should return positional parameter when reading as multi-value`, () => {
        expect(syntax.getMulti('nonexistent', true)).toEqual([positional])
      })
    }
  })
}

describe('invalid positional parameters', () => {
  it('should return null for positional parameters used together with named parameters', () => {
    const syntax = ResourceSyntax.fromString('my-res:pos?x=value')
    expect(syntax.getSingle('x', true)).toBeNull()
    expect(syntax.getMulti('x', true)).toBeNull()
  })
})

describe('containsParamsOtherThan', () => {
  it('should return true if there are additional params', () => {
    const syntax = ResourceSyntax.fromString('my-res?x=value&y=value-y')
    expect(syntax.containsParamsOtherThan(['x'])).toBe(true)
  })
})

describe('url encoding', () => {
  it('should handle URL encoding in positional parameters', () => {
    const syntax = ResourceSyntax.fromString('my-res:my%20pos')
    expect(syntax.positional).toBe('my pos')
  })

  it('should handle URL encoding in named parameters', () => {
    const syntax = ResourceSyntax.fromString('my-res?x=my%20value')
    expect(syntax.getSingle('x')).toBe('my value')
  })

  it(`should allow colon (:) in positional parameters`, () => {
    const syntax = ResourceSyntax.fromString('my-res:my:pos')
    expect(syntax.positional).toBe('my:pos')
  })
})
