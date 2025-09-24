import { ScopeStringSyntax } from './syntax-string.js'
import { ScopeStringFor } from './syntax.js'

describe('ScopeStringSyntax', () => {
  for (const { scope, content } of [
    {
      scope: 'my-res',
      content: { prefix: 'my-res' },
    },
    {
      scope: 'my-res:my-pos',
      content: { prefix: 'my-res', positional: 'my-pos' },
    },
    {
      scope: 'my-res:',
      content: { prefix: 'my-res', positional: '' },
    },
    {
      scope: 'my-res:foo?x=value&y=value-y',
      content: {
        prefix: 'my-res',
        positional: 'foo',
        params: { x: ['value'], y: ['value-y'] },
      },
    },
    {
      scope: 'my-res?x=value&y=value-y',
      content: { prefix: 'my-res', params: { x: ['value'], y: ['value-y'] } },
    },
    {
      scope: 'my-res?x=foo&x=bar&x=baz',
      content: { prefix: 'my-res', params: { x: ['foo', 'bar', 'baz'] } },
    },
    {
      scope: 'rpc:foo.bar?aud=did:foo:bar?lxm=bar.baz',
      content: {
        prefix: 'rpc',
        positional: 'foo.bar',
        params: { aud: ['did:foo:bar?lxm=bar.baz'] },
      },
    },
  ] satisfies Array<{
    scope: ScopeStringFor<'my-res' | 'rpc'>
    content: {
      prefix: string
      positional?: string
      params?: Record<string, string[]>
    }
  }>) {
    const syntax = ScopeStringSyntax.fromString<'my-res' | 'rpc'>(scope)

    describe(scope, () => {
      it('should match the expected syntax', () => {
        expect(syntax).toMatchObject({
          prefix: content.prefix,
          positional: content.positional,
        })
      })

      it(`should match ${scope} prefix`, () => {
        expect(syntax.prefix).toBe(content.prefix)
      })

      it(`should return positional parameter`, () => {
        expect(syntax.positional).toBe(content.positional)
      })

      it(`should return undefined for nonexistent single-value param`, () => {
        expect(syntax.getSingle('nonexistent')).toBeUndefined()
      })

      it(`should return undefined for nonexistent multi-value param`, () => {
        expect(syntax.getMulti('nonexistent')).toBeUndefined()
      })

      const { params } = content
      if (params) {
        it(`only contain allowed parameters`, () => {
          const allowedParams = Object.keys(params) as [string, ...string[]]
          expect(
            Array.from(syntax.keys()).every((key) =>
              allowedParams.includes(key),
            ),
          ).toBe(true)
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
            })
          }
        }
      }
    })
  }

  describe('invalid positional parameters', () => {
    it('should return null for positional parameters used together with named parameters', () => {
      const syntax = ScopeStringSyntax.fromString('my-res:pos?x=value')
      expect(syntax.getSingle('x')).toBe('value')
      expect(syntax.getMulti('x')).toEqual(['value'])
    })
  })

  describe('url encoding', () => {
    it('should handle URL encoding in positional parameters', () => {
      const syntax = ScopeStringSyntax.fromString('my-res:my%20pos')
      expect(syntax.positional).toBe('my pos')
    })

    it('should handle URL encoding in named parameters', () => {
      const syntax = ScopeStringSyntax.fromString('my-res?x=my%20value')
      expect(syntax.getSingle('x')).toBe('my value')
    })

    it(`should allow colon (:) in positional parameters`, () => {
      const syntax = ScopeStringSyntax.fromString('my-res:my:pos')
      expect(syntax.positional).toBe('my:pos')
    })
  })
})
