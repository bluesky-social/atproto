import { ScopesSet } from './scopes-set.js'

describe('ScopesSet', () => {
  it('should initialize with an empty set', () => {
    const set = new ScopesSet()
    expect(set.size).toBe(0)
  })

  it('should add scopes correctly', () => {
    const set = new ScopesSet()
    set.add('repo:read')
    expect(set.size).toBe(1)
    expect(set.has('repo:read')).toBe(true)
    expect(set.has('repo:write')).toBe(false)
  })

  it('should remove scopes correctly', () => {
    const set = new ScopesSet(['repo:read'])
    set.delete('repo:read')
    expect(set.size).toBe(0)
    expect(set.has('repo:read')).toBe(false)
  })
})

// TODO: account
// TODO: identity
// TODO: blob
// TODO: rpc

describe('repo', () => {
  describe('specific collection', () => {
    const set = new ScopesSet([
      'repo:foo.bar.star?action=*',
      'repo:foo.bar.create?action=create',
      'repo:foo.bar.update?action=update',
      'repo:foo.bar.delete?action=delete',
      'repo:foo.bar.cud?action=create&action=update&action=delete',
    ])

    describe('*', () => {
      const action = '*'
      it('should only match "action=*"', () => {
        expect(
          set.matches('repo', { action, collection: 'foo.bar.star' }),
        ).toBe(true)

        expect(
          set.matches('repo', { action, collection: 'foo.bar.update' }),
        ).toBe(false)
      })
    })

    describe('create', () => {
      const action = 'create'
      it('should match "action=*"', () => {
        expect(
          set.matches('repo', { action, collection: 'foo.bar.star' }),
        ).toBe(true)
      })

      it('should match "action=create"', () => {
        expect(
          set.matches('repo', { action, collection: 'foo.bar.create' }),
        ).toBe(true)

        expect(set.matches('repo', { action, collection: 'foo.bar.cud' }))
      })

      it('should not match "action=update"', () => {
        expect(
          set.matches('repo', { action, collection: 'foo.bar.update' }),
        ).toBe(false)
      })
    })

    describe('update', () => {
      const action = 'update'

      it('should match "action=*"', () => {
        expect(
          set.matches('repo', { action, collection: 'foo.bar.star' }),
        ).toBe(true)
      })

      it('should match "action=update"', () => {
        expect(
          set.matches('repo', { action, collection: 'foo.bar.update' }),
        ).toBe(true)

        expect(set.matches('repo', { action, collection: 'foo.bar.cud' })).toBe(
          true,
        )
      })

      it('should not match "action=create"', () => {
        expect(
          set.matches('repo', { action, collection: 'foo.bar.create' }),
        ).toBe(false)
      })
    })

    describe('delete', () => {
      const action = 'delete'

      it('should match "action=*"', () => {
        expect(
          set.matches('repo', { action, collection: 'foo.bar.star' }),
        ).toBe(true)
      })

      it('should match "action=delete"', () => {
        expect(
          set.matches('repo', { action, collection: 'foo.bar.delete' }),
        ).toBe(true)

        expect(set.matches('repo', { action, collection: 'foo.bar.cud' })).toBe(
          true,
        )
      })

      it('should not match "action=create"', () => {
        expect(
          set.matches('repo', { action, collection: 'foo.bar.create' }),
        ).toBe(false)
      })
    })

    it('should not match non-existing collection', () => {
      expect(
        set.matches('repo', {
          action: '*',
          collection: 'foo.bar.nonexistent',
        }),
      ).toBe(false)
      expect(
        set.matches('repo', {
          action: 'create',
          collection: 'foo.bar.nonexistent',
        }),
      ).toBe(false)
      expect(
        set.matches('repo', {
          action: 'update',
          collection: 'foo.bar.nonexistent',
        }),
      ).toBe(false)
      expect(
        set.matches('repo', {
          action: 'delete',
          collection: 'foo.bar.nonexistent',
        }),
      ).toBe(false)
    })
  })

  describe('wildcard on specific collection', () => {
    const set = new ScopesSet([
      'repo:foo.bar.star?action=*',
      'repo:foo.bar.create?action=create',
    ])

    it('should match any action on the collection', () => {
      expect(
        set.matches('repo', { action: 'create', collection: 'foo.bar.star' }),
      ).toBe(true)
      expect(
        set.matches('repo', { action: 'update', collection: 'foo.bar.star' }),
      ).toBe(true)
      expect(
        set.matches('repo', { action: 'delete', collection: 'foo.bar.star' }),
      ).toBe(true)
    })

    it('should not match actions on other collections', () => {
      expect(
        set.matches('repo', { action: 'create', collection: 'foo.bar.create' }),
      ).toBe(true)
      expect(
        set.matches('repo', { action: 'update', collection: 'foo.bar.create' }),
      ).toBe(false)
      expect(
        set.matches('repo', { action: 'delete', collection: 'foo.bar.create' }),
      ).toBe(false)
    })
  })

  describe('wildcard on specific action', () => {
    const set = new ScopesSet(['repo:*?action=create', 'repo:*?action=delete'])

    it('should match create action on any collection', () => {
      expect(
        set.matches('repo', { action: 'create', collection: 'foo.bar' }),
      ).toBe(true)
      expect(
        set.matches('repo', { action: 'create', collection: 'baz.qux' }),
      ).toBe(true)
    })

    it('should match delete action on any collection', () => {
      expect(
        set.matches('repo', { action: 'delete', collection: 'foo.bar' }),
      ).toBe(true)
      expect(
        set.matches('repo', { action: 'delete', collection: 'baz.qux' }),
      ).toBe(true)
    })

    it('should not match update action on any collection', () => {
      expect(
        set.matches('repo', { action: 'update', collection: 'foo.bar' }),
      ).toBe(false)
      expect(
        set.matches('repo', { action: 'update', collection: 'baz.qux' }),
      ).toBe(false)
    })
  })

  describe('wildcard', () => {
    it('should allow any action when using a wildcard scope', () => {
      const set = new ScopesSet(['repo:*?action=*'])
      expect(
        set.matches('repo', { action: 'create', collection: 'foo.bar' }),
      ).toBe(true)
      expect(
        set.matches('repo', { action: 'update', collection: 'baz.qux' }),
      ).toBe(true)
    })
  })
})
