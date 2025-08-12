import { IdentityScope } from './identity-scope.js'

describe('IdentityScope', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse positional scope', () => {
        const scope = IdentityScope.fromString('identity:handle')
        expect(scope).not.toBeNull()
        expect(scope!.attr).toBe('handle')
      })

      it('should parse valid identity scope with wildcard attribute', () => {
        const scope = IdentityScope.fromString('identity:*')
        expect(scope).not.toBeNull()
        expect(scope!.attr).toBe('*')
      })

      it('should return null for invalid identity scope', () => {
        expect(IdentityScope.fromString('invalid')).toBeNull()
        expect(IdentityScope.fromString('identity:invalid')).toBeNull()
      })

      for (const invalid of [
        'identity:*?action=*',
        'identity:*?action=manage',
        'identity:*?action=submit',
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
        const scope = IdentityScope.scopeNeededFor({ attr: 'handle' })
        expect(scope).toBe('identity:handle')
      })

      it('should return scope that accepts all attributes with specific action', () => {
        const scope = IdentityScope.scopeNeededFor({ attr: '*' })
        expect(scope).toBe('identity:*')
      })
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      it('should match default attribute and action', () => {
        const scope = IdentityScope.fromString('identity:handle')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: 'handle' })).toBe(true)
        expect(scope!.matches({ attr: '*' })).toBe(false)
      })

      it('should match wildcard attribute with specific action', () => {
        const scope = IdentityScope.fromString('identity:*')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: '*' })).toBe(true)
        expect(scope!.matches({ attr: 'handle' })).toBe(true)
      })
    })

    describe('toString', () => {
      it('should format scope with default action', () => {
        const scope = new IdentityScope('handle')
        expect(scope.toString()).toBe('identity:handle')
      })

      it('should format wildcard attribute with default action', () => {
        const scope = new IdentityScope('*')
        expect(scope.toString()).toBe('identity:*')
      })
    })
  })
})
