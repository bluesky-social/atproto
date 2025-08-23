import { IdentityPermission } from './identity-permission.js'

describe('IdentityPermission', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse positional scope', () => {
        const scope = IdentityPermission.fromString('identity:handle')
        expect(scope).not.toBeNull()
        expect(scope!.attr).toBe('handle')
      })

      it('should parse valid identity scope with wildcard attribute', () => {
        const scope = IdentityPermission.fromString('identity:*')
        expect(scope).not.toBeNull()
        expect(scope!.attr).toBe('*')
      })

      it('should return null for invalid identity scope', () => {
        expect(IdentityPermission.fromString('invalid')).toBeNull()
        expect(IdentityPermission.fromString('identity:invalid')).toBeNull()
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
          expect(IdentityPermission.fromString(invalid)).toBeNull()
        })
      }
    })

    describe('scopeNeededFor', () => {
      it('should return correct scope string for specific attribute and action', () => {
        const scope = IdentityPermission.scopeNeededFor({ attr: 'handle' })
        expect(scope).toBe('identity:handle')
      })

      it('should return scope that accepts all attributes with specific action', () => {
        const scope = IdentityPermission.scopeNeededFor({ attr: '*' })
        expect(scope).toBe('identity:*')
      })
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      it('should match default attribute and action', () => {
        const scope = IdentityPermission.fromString('identity:handle')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: 'handle' })).toBe(true)
        expect(scope!.matches({ attr: '*' })).toBe(false)
      })

      it('should match wildcard attribute with specific action', () => {
        const scope = IdentityPermission.fromString('identity:*')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: '*' })).toBe(true)
        expect(scope!.matches({ attr: 'handle' })).toBe(true)
      })
    })

    describe('toString', () => {
      it('should format scope with default action', () => {
        const scope = new IdentityPermission('handle')
        expect(scope.toString()).toBe('identity:handle')
      })

      it('should format wildcard attribute with default action', () => {
        const scope = new IdentityPermission('*')
        expect(scope.toString()).toBe('identity:*')
      })
    })
  })
})
