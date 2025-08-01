import { AccountScope } from './account-scope.js'

describe('AccountScope', () => {
  describe('static', () => {
    describe('fromString', () => {
      it('should parse valid scope strings', () => {
        const scope1 = AccountScope.fromString('account:email?action=read')
        expect(scope1).not.toBeNull()
        expect(scope1!.attribute).toBe('email')
        expect(scope1!.action).toBe('read')

        const scope2 = AccountScope.fromString('account:repo?action=manage')
        expect(scope2).not.toBeNull()
        expect(scope2!.attribute).toBe('repo')
        expect(scope2!.action).toBe('manage')
      })

      it('should parse scope without action (defaults to read)', () => {
        const scope = AccountScope.fromString('account:status')
        expect(scope).not.toBeNull()
        expect(scope!.attribute).toBe('status')
        expect(scope!.action).toBe('read')
      })

      it('should reject invalid attribute names', () => {
        const scope = AccountScope.fromString('account:invalid')
        expect(scope).toBeNull()
      })

      it('should reject invalid action names', () => {
        const scope = AccountScope.fromString('account:email?action=invalid')
        expect(scope).toBeNull()
      })

      it('should reject malformed scope strings', () => {
        expect(AccountScope.fromString('invalid:email')).toBeNull()
        expect(AccountScope.fromString('account')).toBeNull()
        expect(AccountScope.fromString('')).toBeNull()
        expect(AccountScope.fromString('account:')).toBeNull()
      })
    })

    describe('scopeNeededFor', () => {
      it('should return correct scope string for read actions', () => {
        expect(
          AccountScope.scopeNeededFor({ attribute: 'email', action: 'read' }),
        ).toBe('account:email')
        expect(
          AccountScope.scopeNeededFor({ attribute: 'repo', action: 'read' }),
        ).toBe('account:repo')
        expect(
          AccountScope.scopeNeededFor({ attribute: 'status', action: 'read' }),
        ).toBe('account:status')
      })

      it('should return correct scope string for manage actions', () => {
        expect(
          AccountScope.scopeNeededFor({ attribute: 'email', action: 'manage' }),
        ).toBe('account:email?action=manage')
        expect(
          AccountScope.scopeNeededFor({ attribute: 'repo', action: 'manage' }),
        ).toBe('account:repo?action=manage')
        expect(
          AccountScope.scopeNeededFor({
            attribute: 'status',
            action: 'manage',
          }),
        ).toBe('account:status?action=manage')
      })
    })
  })

  describe('instance', () => {
    describe('matches', () => {
      it('should match read action', () => {
        const scope = AccountScope.fromString('account:email?action=read')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ action: 'read', attribute: 'email' })).toBe(
          true,
        )
      })

      it('should match manage action', () => {
        const scope = AccountScope.fromString('account:repo?action=manage')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ action: 'manage', attribute: 'repo' })).toBe(
          true,
        )
      })

      it('should not match unspecified action', () => {
        const scope = AccountScope.fromString('account:email?action=read')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ action: 'manage', attribute: 'email' })).toBe(
          false,
        )
      })

      it('should not match different attribute', () => {
        const scope = AccountScope.fromString('account:email?action=read')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ action: 'read', attribute: 'repo' })).toBe(
          false,
        )
      })

      it('should default to "read" action', () => {
        const scope = AccountScope.fromString('account:email')
        expect(scope).not.toBeNull()
        expect(scope!.matches({ action: 'read', attribute: 'email' })).toBe(
          true,
        )
        expect(scope!.matches({ action: 'manage', attribute: 'email' })).toBe(
          false,
        )
      })

      it('should work with all valid attributes', () => {
        const emailScope = AccountScope.fromString('account:email?action=read')
        const repoScope = AccountScope.fromString('account:repo?action=manage')
        const statusScope = AccountScope.fromString(
          'account:status?action=read',
        )

        expect(emailScope).not.toBeNull()
        expect(repoScope).not.toBeNull()
        expect(statusScope).not.toBeNull()

        expect(
          emailScope!.matches({ action: 'read', attribute: 'email' }),
        ).toBe(true)
        expect(
          repoScope!.matches({ action: 'manage', attribute: 'repo' }),
        ).toBe(true)
        expect(
          statusScope!.matches({ action: 'read', attribute: 'status' }),
        ).toBe(true)
      })
    })

    describe('toString', () => {
      it('should format scope with explicit action', () => {
        const scope = new AccountScope('email', 'manage')
        expect(scope.toString()).toBe('account:email?action=manage')
      })

      it('should format scope with default action', () => {
        const scope = new AccountScope('repo', 'read')
        expect(scope.toString()).toBe('account:repo')
      })

      it('should format all attributes correctly', () => {
        expect(new AccountScope('email', 'read').toString()).toBe(
          'account:email',
        )
        expect(new AccountScope('repo', 'read').toString()).toBe('account:repo')
        expect(new AccountScope('status', 'read').toString()).toBe(
          'account:status',
        )
        expect(new AccountScope('email', 'manage').toString()).toBe(
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
      expect(AccountScope.fromString(scope)?.toString()).toBe(scope)
    }
  })
})
