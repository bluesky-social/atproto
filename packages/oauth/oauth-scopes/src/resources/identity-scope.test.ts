import { IdentityScope } from './identity-scope.js'

describe('IdentityScope', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse positional scope', () => {
        const scope = IdentityScope.fromString('identity:handle')
        expect(scope).not.toBeNull()
        expect(scope!.attr).toBe('handle')
        expect(scope!.action).toBe('manage')
      })

      it('properly parse "identity:handle?action=manage"', () => {
        const scope = IdentityScope.fromString('identity:handle?action=manage')
        expect(scope).not.toBeNull()
        expect(scope!.attr).toBe('handle')
        expect(scope!.action).toBe('manage')
      })

      it('properly parse "identity:handle?action=submit"', () => {
        const scope = IdentityScope.fromString('identity:handle?action=submit')
        expect(scope).not.toBeNull()
        expect(scope!.attr).toBe('handle')
        expect(scope!.action).toBe('submit')
      })

      it('should parse valid identity scope with wildcard attribute', () => {
        const scope = IdentityScope.fromString('identity:*')
        expect(scope).not.toBeNull()
        expect(scope!.attr).toBe('*')
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
          attr: 'handle',
          action: 'manage',
        })
        expect(scope).toBe('identity:handle')
      })

      it('should return scope that accepts all attributes with specific action', () => {
        const scope = IdentityScope.scopeNeededFor({
          attr: '*',
          action: 'manage',
        })
        expect(scope).toBe('identity:*')
      })

      it('should return scope that accepts all attributes with manage action', () => {
        const scope = IdentityScope.scopeNeededFor({
          attr: '*',
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
        expect(scope!.matches({ attr: 'handle', action: 'manage' })).toBe(true)
        expect(scope!.matches({ attr: 'handle', action: 'submit' })).toBe(false)
      })

      it('should match specific attribute and action', () => {
        const scope = IdentityScope.fromString('identity:handle?action=manage')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: 'handle', action: 'manage' })).toBe(true)
        expect(scope!.matches({ attr: 'handle', action: 'submit' })).toBe(false)
      })

      it('should match wildcard attribute with specific action', () => {
        const scope = IdentityScope.fromString('identity:*')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: '*', action: 'manage' })).toBe(true)
        expect(scope!.matches({ attr: 'handle', action: 'manage' })).toBe(true)
        expect(scope!.matches({ attr: 'handle', action: 'submit' })).toBe(false)
      })

      it('should not match different attribute', () => {
        const scope = IdentityScope.fromString('identity:handle')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: '*', action: 'manage' })).toBe(false)
      })

      it('should not match different action', () => {
        const scope = IdentityScope.fromString('identity:handle?action=manage')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: 'handle', action: 'submit' })).toBe(false)
      })

      it('should match wildcard attribute and default action', () => {
        const scope = IdentityScope.fromString('identity:*')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: '*', action: 'manage' })).toBe(true)
        expect(scope!.matches({ attr: '*', action: 'submit' })).toBe(false)
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
})
