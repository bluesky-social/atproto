import { IdentityScope } from './identity-scope.js'

describe('IdentityScope', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse positional scope', () => {
        const scope = IdentityScope.fromString('identity:handle')
        expect(scope).not.toBeNull()
        expect(scope!.attribute).toBe('handle')
        expect(scope!.action).toBe('manage')
      })

      it('should parse valid identity scope with action', () => {
        const scope = IdentityScope.fromString('identity:handle?action=manage')
        expect(scope).not.toBeNull()
        expect(scope!.attribute).toBe('handle')
        expect(scope!.action).toBe('manage')
      })

      it('should parse valid identity scope with wildcard attribute', () => {
        const scope = IdentityScope.fromString('identity:*')
        expect(scope).not.toBeNull()
        expect(scope!.attribute).toBe('*')
        expect(scope!.action).toBe('manage')
      })

      it('should return null for invalid identity scope', () => {
        expect(IdentityScope.fromString('invalid')).toBeNull()
        expect(IdentityScope.fromString('identity:invalid')).toBeNull()
      })

      for (const invalid of [
        'identity:*?action=*',
        'invalid',
        'identity:invalid',
        'identity:handle?action=invalid',
        'identity?attribute=invalid&action=invalid',
      ]) {
        it(`should return null for invalid rpc scope: ${invalid}`, () => {
          expect(IdentityScope.fromString(invalid)).toBeNull()
        })
      }
    })

    describe('scopeNeededFor', () => {
      it('should return correct scope string for specific attribute and action', () => {
        const scope = IdentityScope.scopeNeededFor({
          attribute: 'handle',
          action: 'manage',
        })
        expect(scope).toBe('identity:handle')
      })

      it('should return scope that accepts all attributes with specific action', () => {
        const scope = IdentityScope.scopeNeededFor({
          attribute: '*',
          action: 'manage',
        })
        expect(scope).toBe('identity:*')
      })

      it('should return scope that accepts all attributes with manage action', () => {
        const scope = IdentityScope.scopeNeededFor({
          attribute: '*',
          action: 'manage',
        })
        expect(scope).toBe('identity:*')
      })
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      it('should match default attribute and action', () => {
        const scope = IdentityScope.fromString('identity:handle')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attribute: 'handle', action: 'manage' })).toBe(
          true,
        )
        expect(scope!.matches({ attribute: 'handle', action: 'submit' })).toBe(
          false,
        )
      })

      it('should match specific attribute and action', () => {
        const scope = IdentityScope.fromString('identity:handle?action=manage')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attribute: 'handle', action: 'manage' })).toBe(
          true,
        )
        expect(scope!.matches({ attribute: 'handle', action: 'submit' })).toBe(
          false,
        )
      })

      it('should match wildcard attribute with specific action', () => {
        const scope = IdentityScope.fromString('identity:*')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attribute: '*', action: 'manage' })).toBe(true)
        expect(scope!.matches({ attribute: 'handle', action: 'manage' })).toBe(
          true,
        )
        expect(scope!.matches({ attribute: 'handle', action: 'submit' })).toBe(
          false,
        )
      })

      it('should not match different attribute', () => {
        const scope = IdentityScope.fromString('identity:handle')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attribute: '*', action: 'manage' })).toBe(false)
      })

      it('should not match different action', () => {
        const scope = IdentityScope.fromString('identity:handle?action=manage')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attribute: 'handle', action: 'submit' })).toBe(
          false,
        )
      })

      it('should match wildcard attribute and default action', () => {
        const scope = IdentityScope.fromString('identity:*')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attribute: '*', action: 'manage' })).toBe(true)
        expect(scope!.matches({ attribute: '*', action: 'submit' })).toBe(false)
      })
    })

    describe('toString', () => {
      it('should format scope with default action', () => {
        const scope = new IdentityScope('handle', 'manage')
        expect(scope.toString()).toBe('identity:handle')
      })

      it('should format scope with specific action', () => {
        const scope = new IdentityScope('handle', 'submit')
        expect(scope.toString()).toBe('identity:handle?action=submit')
      })

      it('should format wildcard attribute with default action', () => {
        const scope = new IdentityScope('*', 'manage')
        expect(scope.toString()).toBe('identity:*')
      })

      it('should format wildcard attribute with specific action', () => {
        const scope = new IdentityScope('*', 'submit')
        expect(scope.toString()).toBe('identity:*?action=submit')
      })
    })
  })

  describe('normalization', () => {
    const testCases: { input: string; expected: string }[] = [
      { input: 'identity:handle', expected: 'identity:handle' },
      { input: 'identity?attribute=handle', expected: 'identity:handle' },
      {
        input: 'identity?attribute=handle&action=manage',
        expected: 'identity:handle',
      },
      { input: 'identity:handle?action=manage', expected: 'identity:handle' },

      {
        input: 'identity:handle?action=submit',
        expected: 'identity:handle?action=submit',
      },
      {
        input: 'identity?action=submit&attribute=handle',
        expected: 'identity:handle?action=submit',
      },

      { input: 'identity:*', expected: 'identity:*' },
    ]

    for (const { input, expected } of testCases) {
      it(`should properly re-format ${input}`, () => {
        expect(IdentityScope.fromString(input)?.toString()).toBe(expected)
      })
    }
  })
})
