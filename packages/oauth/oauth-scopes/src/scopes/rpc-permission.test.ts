import { RpcPermission } from './rpc-permission.js'

describe('RpcPermission', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse positional scope', () => {
        const scope = RpcPermission.fromString(
          'rpc:com.example.service?aud=did:web:example.com%23service_id',
        )
        expect(scope).not.toBeNull()
        expect(scope!.aud).toBe('did:web:example.com#service_id')
        expect(scope!.lxm).toEqual(['com.example.service'])
      })

      it('should parse strings correctly', () => {
        expect(
          RpcPermission.fromString('rpc?lxm=com.example.method1&aud=*'),
        ).toEqual({
          aud: '*',
          lxm: ['com.example.method1'],
        })
        expect(
          RpcPermission.fromString('rpc:com.example.method1?aud=*'),
        ).toEqual({
          aud: '*',
          lxm: ['com.example.method1'],
        })
      })

      it('should render strings correctly', () => {
        expect(
          new RpcPermission('did:web:example.com#service_id', [
            'com.example.service',
          ]).toString(),
        ).toBe('rpc:com.example.service?aud=did:web:example.com%23service_id')
        expect(new RpcPermission('*', ['com.example.method1']).toString()).toBe(
          'rpc:com.example.method1?aud=*',
        )
        expect(
          new RpcPermission('did:web:example.com#service_id', [
            'com.example.method1',
            'com.example.method2',
          ]).toString(),
        ).toBe(
          'rpc?lxm=com.example.method1&lxm=com.example.method2&aud=did:web:example.com%23service_id',
        )
      })

      it('should reject scopes without lxm', () => {
        expect(
          RpcPermission.fromString('rpc?aud=did:web:example.com%23service_id'),
        ).toBeNull()
        expect(
          RpcPermission.fromString('rpc:?aud=did:web:example.com%23service_id'),
        ).toBeNull()
      })

      it('should reject scopes without aud', () => {
        expect(
          RpcPermission.fromString('rpc?lxm=com.example.method1'),
        ).toBeNull()
        expect(RpcPermission.fromString('rpc:com.example.method1')).toBeNull()
      })

      it('should reject scopes with lxm in both positional and query form', () => {
        expect(
          RpcPermission.fromString(
            'rpc:com.example.method1?aud=did:web:example.com&lxm=com.example.method2',
          ),
        ).toBeNull()
      })

      it('should parse valid rpc scope with multiple lxm', () => {
        const scope = RpcPermission.fromString(
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
        const scope = RpcPermission.fromString('rpc?aud=did:web:example.com')
        expect(scope).toBeNull()
      })

      it('should reject rpc scope without aud', () => {
        const scope = RpcPermission.fromString('rpc?lxm=com.example.method1')
        expect(scope).toBeNull()
      })

      it('should reject any aud/any lxm', () => {
        expect(RpcPermission.fromString('rpc?aud=*&lxm=*')).toBeNull()
        expect(RpcPermission.fromString('rpc:*?aud=*')).toBeNull()
      })

      it('should reject missing aud', () => {
        expect(RpcPermission.fromString('rpc:com.example.service')).toBeNull()
      })

      it('should reject invalid aud', () => {
        expect(
          RpcPermission.fromString('rpc:com.example.service?aud=invalid'),
        ).toBeNull()
      })

      it('should reject invalid lxm', () => {
        expect(RpcPermission.fromString('rpc:invalid')).toBeNull()
        expect(RpcPermission.fromString('rpc?lxm=invalid')).toBeNull()
      })

      for (const invalid of [
        'rpc:*',
        'invalid',
        'rpc:invalid',
        'rpc:invalid?aud=did:web:example.com',
        'rpc:invalid?aud=did:web:example.com%23service_id',
        'rpc:foo.bar',
        'rpc:com.example.service?aud=did:web:example.com%23service_id&invalid=param',
        'rpc:foo.bar.baz?aud=did:web',
        'rpc:foo.bar.baz?aud=did:web%23service_id',
        'rpc:foo.bar.baz?aud=did:plc:111',
        'rpc:foo.bar.baz?aud=did:plc:111%23service_id',
        'rpc:foo.bar.baz?aud=did:foo:bar',
        'rpc:foo.bar.baz?aud=did:foo:bar%23service_id',
        'rpc:foo.bar.baz?aud=did:web:example.com%23service_id&lxm=foo.bar.baz',
        'rpc:foo.bar.baz?aud=invalid',
        'rpc:invalid?aud=did:web:example.com',
        'rpc:invalid?aud=did:web:example.com%23service_id',
        'rpc:com.example.service?aud=invalid',
        'notrpc:com.example.service?aud=did:web:example.com%23service_id',
        'rpc?lxm=invalid&aud=invalid',
      ]) {
        it(`should return null for invalid rpc scope: ${invalid}`, () => {
          expect(RpcPermission.fromString(invalid)).toBeNull()
        })
      }
    })

    describe('scopeNeededFor', () => {
      it('should return correct scope string for specific lxm and aud', () => {
        const scope = RpcPermission.scopeNeededFor({
          lxm: 'com.example.service',
          aud: 'did:web:example.com#service_id',
        })
        expect(scope).toBe(
          'rpc:com.example.service?aud=did:web:example.com%23service_id',
        )
      })

      it('should return scope that accepts all aud with specific lxm', () => {
        const scope = RpcPermission.scopeNeededFor({
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
        const scope = RpcPermission.fromString(
          'rpc:com.example.service?aud=did:web:example.com%23service_id',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.service',
            aud: 'did:web:example.com#service_id',
          }),
        ).toBe(true)
      })

      it('should not match different lxm', () => {
        const scope = RpcPermission.fromString(
          'rpc:com.example.service?aud=did:web:example.com%23service_id',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.OtherService',
            aud: 'did:web:example.com#service_id',
          }),
        ).toBe(false)
      })

      it('should not match different aud', () => {
        const scope = RpcPermission.fromString(
          'rpc:com.example.service?aud=did:web:example.com%23service_id',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.service',
            aud: 'did:example:456#service_id',
          }),
        ).toBe(false)
      })

      it('should match wildcard aud', () => {
        const scope = RpcPermission.fromString('rpc:com.example.method1?aud=*')
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.method1',
            aud: 'did:web:example.com#service_id',
          }),
        ).toBe(true)
      })

      it('should match wildcard lxm', () => {
        const scope = RpcPermission.fromString(
          'rpc:*?aud=did:web:example.com%23service_id',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.method1',
            aud: 'did:web:example.com#service_id',
          }),
        ).toBe(true)
      })

      it('should not match different lxm with wildcard aud', () => {
        const scope = RpcPermission.fromString(
          'rpc:*?aud=did:web:example.com%23service_id',
        )
        expect(scope).not.toBeNull()
        expect(
          scope!.matches({
            lxm: 'com.example.anyMethod',
            aud: 'did:web:example.com#service_id',
          }),
        ).toBe(true)
      })
    })

    describe('toString', () => {
      it('should format scope with lxm and aud', () => {
        const scope = new RpcPermission('did:web:example.com#service_id', [
          'com.example.service',
        ])
        expect(scope.toString()).toBe(
          'rpc:com.example.service?aud=did:web:example.com%23service_id',
        )
      })

      it('should format scope with wildcard aud', () => {
        const scope = new RpcPermission('*', ['com.example.method1'])
        expect(scope.toString()).toBe('rpc:com.example.method1?aud=*')
      })

      it('should format scope with wildcard lxm', () => {
        const scope = new RpcPermission('did:web:example.com#service_id', ['*'])
        expect(scope.toString()).toBe(
          'rpc:*?aud=did:web:example.com%23service_id',
        )
      })

      it('simplifies lxm if one of them is "*"', () => {
        const scope = new RpcPermission('did:web:example.com#service_id', [
          '*',
          'com.example.method1',
        ])
        expect(scope.toString()).toBe(
          'rpc:*?aud=did:web:example.com%23service_id',
        )
      })
    })
  })

  describe('consistency', () => {
    const testCases: { input: string; expected: string }[] = [
      {
        input: 'rpc:com.example.service?aud=did:web:example.com%23service_id',
        expected:
          'rpc:com.example.service?aud=did:web:example.com%23service_id',
      },
      {
        input: 'rpc:com.example.service?aud=did:web:example.com#service_id',
        expected:
          'rpc:com.example.service?aud=did:web:example.com%23service_id',
      },
      {
        input: 'rpc?lxm=com.example.method1&lxm=com.example.method2&aud=*',
        expected: 'rpc?lxm=com.example.method1&lxm=com.example.method2&aud=*',
      },
      {
        input:
          'rpc?lxm=com.example.method1&lxm=com.example.method2&lxm=*&aud=did:web:example.com%23service_id',
        expected: 'rpc:*?aud=did:web:example.com%23service_id',
      },
      {
        input: 'rpc?aud=did:web:example.com%23foo&lxm=com.example.service',
        expected: 'rpc:com.example.service?aud=did:web:example.com%23foo',
      },
      {
        input: 'rpc?lxm=com.example.method1&aud=did:web:example.com#foo',
        expected: 'rpc:com.example.method1?aud=did:web:example.com%23foo',
      },
      {
        input: 'rpc?lxm=com.example.method1&aud=did:web:example.com%23bar',
        expected: 'rpc:com.example.method1?aud=did:web:example.com%23bar',
      },
      {
        input: 'rpc:com.example.method1?&aud=*',
        expected: 'rpc:com.example.method1?aud=*',
      },
    ]

    for (const { input, expected } of testCases) {
      it(`should properly re-format ${input}`, () => {
        expect(RpcPermission.fromString(input)?.toString()).toBe(expected)
      })
    }
  })
})
