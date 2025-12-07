import { AccountPermission } from './account-permission.js'

describe('AccountPermission', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse valid scope strings', () => {
        const scope1 = AccountPermission.fromString('account:email?action=read')
        expect(scope1).not.toBeNull()
        expect(scope1!.attr).toBe('email')
        expect(scope1!.action).toEqual(['read'])

        const scope2 = AccountPermission.fromString(
          'account:repo?action=manage',
        )
        expect(scope2).not.toBeNull()
        expect(scope2!.attr).toBe('repo')
        expect(scope2!.action).toEqual(['manage'])
      })

      it('should parse scope without action (defaults to read)', () => {
        const scope = AccountPermission.fromString('account:status')
        expect(scope).not.toBeNull()
        expect(scope!.attr).toBe('status')
        expect(scope!.action).toEqual(['read'])
      })

      it('should reject invalid attribute names', () => {
        const scope = AccountPermission.fromString('account:invalid')
        expect(scope).toBeNull()
      })

      it('should reject invalid action names', () => {
        const scope = AccountPermission.fromString(
          'account:email?action=invalid',
        )
        expect(scope).toBeNull()
      })

      it('should reject malformed scope strings', () => {
        expect(AccountPermission.fromString('invalid:email')).toBeNull()
        expect(AccountPermission.fromString('account')).toBeNull()
        expect(AccountPermission.fromString('')).toBeNull()
        expect(AccountPermission.fromString('account:')).toBeNull()
      })
    })

    describe('scopeNeededFor', () => {
      it('should return correct scope string for read actions', () => {
        expect(
          AccountPermission.scopeNeededFor({ attr: 'email', action: 'read' }),
        ).toBe('account:email')
        expect(
          AccountPermission.scopeNeededFor({ attr: 'repo', action: 'read' }),
        ).toBe('account:repo')
        expect(
          AccountPermission.scopeNeededFor({ attr: 'status', action: 'read' }),
        ).toBe('account:status')
      })

      it('should return correct scope string for manage actions', () => {
        expect(
          AccountPermission.scopeNeededFor({ attr: 'email', action: 'manage' }),
        ).toBe('account:email?action=manage')
        expect(
          AccountPermission.scopeNeededFor({ attr: 'repo', action: 'manage' }),
        ).toBe('account:repo?action=manage')
        expect(
          AccountPermission.scopeNeededFor({
            attr: 'status',
            action: 'manage',
          }),
        ).toBe('account:status?action=manage')
      })
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      it('should match read action', () => {
        const scope = AccountPermission.fromString('account:email?action=read')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: 'email', action: 'read' })).toBe(true)
      })

      it('should match manage action', () => {
        const scope = AccountPermission.fromString('account:repo?action=manage')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: 'repo', action: 'manage' })).toBe(true)
      })

      it('should not match unspecified action', () => {
        const scope = AccountPermission.fromString('account:email?action=read')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: 'email', action: 'manage' })).toBe(false)
      })

      it('should not match different attribute', () => {
        const scope = AccountPermission.fromString('account:email?action=read')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: 'repo', action: 'read' })).toBe(false)
      })

      it('should default to "read" action', () => {
        const scope = AccountPermission.fromString('account:email')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: 'email', action: 'read' })).toBe(true)
        expect(scope!.matches({ attr: 'email', action: 'manage' })).toBe(false)
      })

      it('should work with all valid attributes', () => {
        const emailScope = AccountPermission.fromString(
          'account:email?action=read',
        )
        const repoScope = AccountPermission.fromString(
          'account:repo?action=manage',
        )
        const statusScope = AccountPermission.fromString(
          'account:status?action=read',
        )

        expect(emailScope).not.toBeNull()
        expect(repoScope).not.toBeNull()
        expect(statusScope).not.toBeNull()

        expect(emailScope!.matches({ attr: 'email', action: 'read' })).toBe(
          true,
        )
        expect(repoScope!.matches({ attr: 'repo', action: 'manage' })).toBe(
          true,
        )
        expect(statusScope!.matches({ attr: 'status', action: 'read' })).toBe(
          true,
        )
      })

      it('should allow read when "manage" action is specified', () => {
        const scope = AccountPermission.fromString(
          'account:email?action=manage',
        )
        expect(scope).not.toBeNull()
        expect(scope!.matches({ attr: 'email', action: 'read' })).toBe(true)
      })
    })

    describe('toString', () => {
      it('should format scope with explicit action', () => {
        const scope = new AccountPermission('email', ['manage'])
        expect(scope.toString()).toBe('account:email?action=manage')
      })

      it('should format scope with default action', () => {
        const scope = new AccountPermission('repo', ['read'])
        expect(scope.toString()).toBe('account:repo')
      })

      it('should format all attributes correctly', () => {
        expect(new AccountPermission('email', ['read']).toString()).toBe(
          'account:email',
        )
        expect(new AccountPermission('repo', ['read']).toString()).toBe(
          'account:repo',
        )
        expect(new AccountPermission('status', ['read']).toString()).toBe(
          'account:status',
        )
        expect(new AccountPermission('email', ['manage']).toString()).toBe(
          'account:email?action=manage',
        )
      })
    })
  })

  it('should maintain consistency between toString and fromString', () => {
    const testCases = [
      'account:email',
      'account:email?action=manage',
      'account:repo',
      'account:repo?action=manage',
      'account:status',
      'account:status?action=manage',
    ]

    for (const scope of testCases) {
      expect(AccountPermission.fromString(scope)?.toString()).toBe(scope)
    }
  })
})
