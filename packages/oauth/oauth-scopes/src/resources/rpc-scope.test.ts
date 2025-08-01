import { RpcScope } from './rpc-scope.js'

describe('RpcScope', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse positional scope', () => {
        const scope = RpcScope.fromString(
          'rpc:com.example.Service?aud=did:example:123',
        )
        expect(scope).not.toBeNull()
        expect(scope!.aud).toBe('did:example:123')
        expect(scope!.lxm).toEqual(['com.example.Service'])
      })

      it('should parse valid rpc scope with multiple lxm', () => {
        const scope = RpcScope.fromString(
          'rpc?aud=*&lxm=com.example.Method1&lxm=com.example.Method2',
        )
        expect(scope).not.toBeNull()
        expect(scope!.aud).toBe('*')
        expect(scope!.lxm).toEqual([
          'com.example.Method1',
          'com.example.Method2',
        ])
      })

      it('should reject rpc scope without lxm', () => {
        const scope = RpcScope.fromString('rpc?aud=did:example:123')
        expect(scope).toBeNull()
      })

      it('should reject rpc scope without aud', () => {
        const scope = RpcScope.fromString('rpc?lxm=com.example.Method1')
        expect(scope).toBeNull()
      })

      for (const invalid of [
        'rpc:*?aud=*',
        'rpc:*',
        'invalid',
        'rpc:invalid',
        'rpc:com.example.Service?aud=invalid',
        'notrpc:com.example.Service?aud=did:example:123',
        'rpc?lxm=invalid&aud=invalid',
      ]) {
        it(`should return null for invalid rpc scope: ${invalid}`, () => {
          expect(RpcScope.fromString(invalid)).toBeNull()
        })
      }
    })

    describe('scopeNeededFor', () => {
      //
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      //
    })

    describe('toString', () => {
      //
    })
  })

  describe('consistency', () => {
    const testCases: { input: string; expected: string }[] = [
      //
    ]

    for (const { input, expected } of testCases) {
      it(`should properly re-format ${input}`, () => {
        expect(RpcScope.fromString(input)?.toString()).toBe(expected)
      })
    }
  })
})
