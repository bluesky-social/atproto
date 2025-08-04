import { RpcScope } from './rpc-scope.js'

describe('RpcScope', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse positional scope', () => {
        const scope = RpcScope.fromString(
          'rpc:com.example.service?aud=did:example:123',
        )
        expect(scope).not.toBeNull()
        expect(scope!.aud).toBe('did:example:123')
        expect(scope!.lxm).toEqual(['com.example.service'])
      })

      it('should parse strings correctly', () => {
        expect(
          RpcScope.fromString('rpc?lxm=com.example.method1&aud=*'),
        ).toEqual({
          aud: '*',
          lxm: ['com.example.method1'],
        })
        expect(RpcScope.fromString('rpc:com.example.method1?aud=*')).toEqual({
          aud: '*',
          lxm: ['com.example.method1'],
        })
      })

      it('should render strings correctly', () => {
        expect(
          new RpcScope('did:example:123', ['com.example.service']).toString(),
        ).toBe('rpc:com.example.service?aud=did:example:123')
        expect(new RpcScope('*', ['com.example.method1']).toString()).toBe(
          'rpc:com.example.method1?aud=*',
        )
        expect(
          new RpcScope('did:example:123', [
            'com.example.method1',
            'com.example.method2',
          ]).toString(),
        ).toBe(
          'rpc?lxm=com.example.method1&lxm=com.example.method2&aud=did:example:123',
        )
      })

      it('should reject scopes without lxm', () => {
        expect(RpcScope.fromString('rpc?aud=did:example:123')).toBeNull()
        expect(RpcScope.fromString('rpc:?aud=did:example:123')).toBeNull()
      })

      it('should reject scopes without aud', () => {
        expect(RpcScope.fromString('rpc?lxm=com.example.method1')).toBeNull()
        expect(RpcScope.fromString('rpc:com.example.method1')).toBeNull()
      })

      it('should reject scopes with lxm in both positional and query form', () => {
        expect(
          RpcScope.fromString(
            'rpc:com.example.method1?aud=did:example:123&lxm=com.example.method2',
          ),
        ).toBeNull()
      })

      it('should parse valid rpc scope with multiple lxm', () => {
        const scope = RpcScope.fromString(
          'rpc?aud=*&lxm=com.example.method1&lxm=com.example.method2',
        )
        expect(scope).not.toBeNull()
        expect(scope!.aud).toBe('*')
        expect(scope!.lxm).toEqual([
          'com.example.method1',
          'com.example.method2',
        ])
      })

      it('should reject rpc scope without lxm', () => {
        const scope = RpcScope.fromString('rpc?aud=did:example:123')
        expect(scope).toBeNull()
      })

      it('should reject rpc scope without aud', () => {
        const scope = RpcScope.fromString('rpc?lxm=com.example.method1')
        expect(scope).toBeNull()
      })

      it('should reject any aud/any lxm', () => {
        expect(RpcScope.fromString('rpc?aud=*&lxm=*')).toBeNull()
        expect(RpcScope.fromString('rpc:*?aud=*')).toBeNull()
      })

      it('should reject missing aud', () => {
        expect(RpcScope.fromString('rpc:com.example.service')).toBeNull()
      })

      it('should reject invalid aud', () => {
        expect(
          RpcScope.fromString('rpc:com.example.service?aud=invalid'),
        ).toBeNull()
      })

      it('should reject invalid lxm', () => {
        expect(RpcScope.fromString('rpc:invalid')).toBeNull()
        expect(RpcScope.fromString('rpc?lxm=invalid')).toBeNull()
      })

      for (const invalid of [
        'rpc:*',
        'invalid',
        'rpc:invalid',
        'rpc:invalid?aud=did:foo:bar',
        'rpc:foo.bar?aud=did:foo:bar&lxm=bar.baz',
        'rpc:foo.bar?aud=invalid',
        'rpc:invalid?aud=did:example:123',
        'rpc:com.example.service?aud=invalid',
        'notrpc:com.example.service?aud=did:example:123',
        'rpc?lxm=invalid&aud=invalid',
      ]) {
        it(`should return null for invalid rpc scope: ${invalid}`, () => {
          expect(RpcScope.fromString(invalid)).toBeNull()
        })
      }
    })

    describe('scopeNeededFor', () => {
      it('should return correct scope string for specific lxm and aud', () => {
        const scope = RpcScope.scopeNeededFor({
          lxm: 'com.example.service',
          aud: 'did:example:123',
        })
        expect(scope).toBe('rpc:com.example.service?aud=did:example:123')
      })

      it('should return scope that accepts all aud with specific lxm', () => {
        const scope = RpcScope.scopeNeededFor({
          lxm: 'com.example.method1',
          aud: '*',
        })
        expect(scope).toBe('rpc:com.example.method1?aud=*')
      })
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      it('should match exact lxm and aud', () => {
        const scope = RpcScope.fromString(
          'rpc:com.example.service?aud=did:example:123',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.service',
            aud: 'did:example:123',
          }),
        ).toBe(true)
      })

      it('should not match different lxm', () => {
        const scope = RpcScope.fromString(
          'rpc:com.example.service?aud=did:example:123',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.OtherService',
            aud: 'did:example:123',
          }),
        ).toBe(false)
      })

      it('should not match different aud', () => {
        const scope = RpcScope.fromString(
          'rpc:com.example.service?aud=did:example:123',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.service',
            aud: 'did:example:456',
          }),
        ).toBe(false)
      })

      it('should match wildcard aud', () => {
        const scope = RpcScope.fromString('rpc:com.example.method1?aud=*')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.method1',
            aud: 'did:example:123',
          }),
        ).toBe(true)
      })

      it('should match wildcard lxm', () => {
        const scope = RpcScope.fromString('rpc:*?aud=did:example:123')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.method1',
            aud: 'did:example:123',
          }),
        ).toBe(true)
      })

      it('should not match different lxm with wildcard aud', () => {
        const scope = RpcScope.fromString('rpc:*?aud=did:example:123')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.anyMethod',
            aud: 'did:example:123',
          }),
        ).toBe(true)
      })
    })

    describe('toString', () => {
      it('should format scope with lxm and aud', () => {
        const scope = new RpcScope('did:example:123', ['com.example.service'])
        expect(scope.toString()).toBe(
          'rpc:com.example.service?aud=did:example:123',
        )
      })

      it('should format scope with wildcard aud', () => {
        const scope = new RpcScope('*', ['com.example.method1'])
        expect(scope.toString()).toBe('rpc:com.example.method1?aud=*')
      })

      it('should format scope with wildcard lxm', () => {
        const scope = new RpcScope('did:example:123', ['*'])
        expect(scope.toString()).toBe('rpc:*?aud=did:example:123')
      })

      it('simplifies lxm if one of them is "*"', () => {
        const scope = new RpcScope('did:example:123', [
          '*',
          'com.example.method1',
        ])
        expect(scope.toString()).toBe('rpc:*?aud=did:example:123')
      })
    })
  })

  describe('consistency', () => {
    const testCases: { input: string; expected: string }[] = [
      {
        input: 'rpc:com.example.service?aud=did:example:123',
        expected: 'rpc:com.example.service?aud=did:example:123',
      },
      {
        input: 'rpc?lxm=com.example.method1&lxm=com.example.method2&aud=*',
        expected: 'rpc?lxm=com.example.method1&lxm=com.example.method2&aud=*',
      },
      {
        input:
          'rpc?lxm=com.example.method1&lxm=com.example.method2&lxm=*&aud=did:example:123',
        expected: 'rpc:*?aud=did:example:123',
      },
      {
        input: 'rpc?aud=did:example:123&lxm=com.example.service',
        expected: 'rpc:com.example.service?aud=did:example:123',
      },
      {
        input: 'rpc?lxm=com.example.method1&aud=did:example:123',
        expected: 'rpc:com.example.method1?aud=did:example:123',
      },
      {
        input: 'rpc:com.example.method1?&aud=*',
        expected: 'rpc:com.example.method1?aud=*',
      },
    ]

    for (const { input, expected } of testCases) {
      it(`should properly re-format ${input}`, () => {
        expect(RpcScope.fromString(input)?.toString()).toBe(expected)
      })
    }
  })
})
