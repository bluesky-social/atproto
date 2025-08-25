import { ScopePermissionsTransition } from './scope-permissions-transition.js'

describe('ScopePermissionsTransition', () => {
  describe('allowsAccount', () => {
    it('should allow account:email with transition:email', () => {
      const set = new ScopePermissionsTransition(
        'transition:email account:repo',
      )
      expect(set.allowsAccount({ attr: 'email', action: 'read' })).toBe(true)
      expect(set.allowsAccount({ attr: 'email', action: 'manage' })).toBe(false)

      expect(set.allowsAccount({ attr: 'repo', action: 'read' })).toBe(true)
      expect(set.allowsAccount({ attr: 'repo', action: 'manage' })).toBe(false)

      expect(set.allowsAccount({ attr: 'status', action: 'read' })).toBe(false)
      expect(set.allowsAccount({ attr: 'status', action: 'manage' })).toBe(
        false,
      )
    })
  })

  describe('allowsBlob', () => {
    it('should allow blob with transition:generic', () => {
      const set = new ScopePermissionsTransition('transition:generic')
      expect(set.allowsBlob({ mime: 'foo/bar' })).toBe(true)
    })
  })

  describe('allowsRepo', () => {
    it('should allow repo with transition:generic', () => {
      const set = new ScopePermissionsTransition('transition:generic')
      expect(
        set.allowsRepo({ collection: 'app.bsky.feed.post', action: 'create' }),
      ).toBe(true)
      expect(
        set.allowsRepo({ collection: 'app.bsky.feed.post', action: 'delete' }),
      ).toBe(true)
      expect(
        set.allowsRepo({ collection: 'com.example.foo', action: 'create' }),
      ).toBe(true)
      expect(
        set.allowsRepo({ collection: 'com.example.foo', action: 'update' }),
      ).toBe(true)
    })
  })

  describe('allowsRpc', () => {
    it('should allow rpc with transition:generic', () => {
      const set = new ScopePermissionsTransition('transition:generic')
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'app.bsky.feed.post',
        }),
      ).toBe(true)
      expect(
        set.allowsRpc({ aud: 'did:web:example.com', lxm: 'com.example.foo' }),
      ).toBe(true)
      expect(set.allowsRpc({ aud: 'did:web:example.com', lxm: '*' })).toBe(true)
    })

    it('should allow chat.bsky.* methods with "transition:chat.bsky"', () => {
      const set = new ScopePermissionsTransition('transition:chat.bsky')
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'chat.bsky.message.send',
        }),
      ).toBe(true)
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'chat.bsky.conversation.get',
        }),
      ).toBe(true)

      // Control

      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'app.bsky.feed.post',
        }),
      ).toBe(false)
      expect(
        set.allowsRpc({ aud: 'did:web:example.com', lxm: 'com.example.foo' }),
      ).toBe(false)
      expect(set.allowsRpc({ aud: 'did:web:example.com', lxm: '*' })).toBe(
        false,
      )
    })

    it('should reject chat methods with "transition:generic"', () => {
      const set = new ScopePermissionsTransition('transition:generic')

      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'chat.bsky.message.send',
        }),
      ).toBe(false)
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'chat.bsky.conversation.get',
        }),
      ).toBe(false)

      // Control

      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'app.bsky.feed.post',
        }),
      ).toBe(true)
      expect(
        set.allowsRpc({ aud: 'did:web:example.com', lxm: 'com.example.foo' }),
      ).toBe(true)
    })
  })
})
