import { ScopePermissions } from './scope-permissions.js'

describe('ScopePermissions', () => {
  describe('allowsAccount', () => {
    it('should properly allow "account:email"', () => {
      const set = new ScopePermissions('account:email')

      expect(set.allowsAccount({ attr: 'email', action: 'read' })).toBe(true)
      expect(set.allowsAccount({ attr: 'email', action: 'manage' })).toBe(false)

      expect(set.allowsAccount({ attr: 'repo', action: 'read' })).toBe(false)
      expect(set.allowsAccount({ attr: 'repo', action: 'manage' })).toBe(false)

      expect(set.allowsAccount({ attr: 'status', action: 'read' })).toBe(false)
      expect(set.allowsAccount({ attr: 'status', action: 'manage' })).toBe(
        false,
      )
    })

    it('should ignore "transition:email"', () => {
      const set = new ScopePermissions('transition:email')

      expect(set.allowsAccount({ attr: 'email', action: 'read' })).toBe(false)
      expect(set.allowsAccount({ attr: 'email', action: 'manage' })).toBe(false)
    })
  })

  describe('allowsBlob', () => {
    it('should allow any mime with "blob:*/*"', () => {
      const set = new ScopePermissions('blob:*/*')
      expect(set.allowsBlob({ mime: 'image/png' })).toBe(true)
      expect(set.allowsBlob({ mime: 'application/json' })).toBe(true)
    })

    it('should only allow images with "blob:image/*"', () => {
      const set = new ScopePermissions('blob:image/*')
      expect(set.allowsBlob({ mime: 'image/png' })).toBe(true)
      expect(set.allowsBlob({ mime: 'application/json' })).toBe(false)
    })

    it('should ignore invalid scope "blob:*"', () => {
      const set = new ScopePermissions('blob:*')
      expect(set.allowsBlob({ mime: 'image/png' })).toBe(false)
      expect(set.allowsBlob({ mime: 'application/json' })).toBe(false)
    })

    it('should ignore invalid scope "blob:/image"', () => {
      const set = new ScopePermissions('blob:/image')
      expect(set.allowsBlob({ mime: 'image/png' })).toBe(false)
      expect(set.allowsBlob({ mime: 'application/json' })).toBe(false)
    })

    it('should ignore "transition:generic"', () => {
      const set = new ScopePermissions('transition:generic')
      expect(set.allowsBlob({ mime: 'image/png' })).toBe(false)
      expect(set.allowsBlob({ mime: 'application/json' })).toBe(false)
    })
  })

  describe('allowsRepo', () => {
    it('should allow any repo action with "repo:*"', () => {
      const set = new ScopePermissions('repo:*')
      expect(
        set.allowsRepo({ collection: 'com.example.foo', action: 'create' }),
      ).toBe(true)
      expect(
        set.allowsRepo({ collection: 'com.example.foo', action: 'update' }),
      ).toBe(true)
      expect(
        set.allowsRepo({ collection: 'app.bsky.feed.post', action: 'delete' }),
      ).toBe(true)
    })

    it('should allow specific repo actions', () => {
      const set = new ScopePermissions('repo:*?action=create')
      expect(
        set.allowsRepo({ collection: 'com.example.foo', action: 'create' }),
      ).toBe(true)
      expect(
        set.allowsRepo({ collection: 'app.bsky.feed.post', action: 'create' }),
      ).toBe(true)

      // Control

      expect(
        set.allowsRepo({ collection: 'com.example.foo', action: 'update' }),
      ).toBe(false)
      expect(
        set.allowsRepo({ collection: 'app.bsky.feed.post', action: 'delete' }),
      ).toBe(false)
    })

    it('should allow specific repo collection & actions', () => {
      const set = new ScopePermissions('repo:com.example.foo?action=create')
      expect(
        set.allowsRepo({ collection: 'com.example.foo', action: 'create' }),
      ).toBe(true)

      // Control

      expect(
        set.allowsRepo({ collection: 'com.example.foo', action: 'update' }),
      ).toBe(false)
      expect(
        set.allowsRepo({ collection: 'app.bsky.feed.post', action: 'delete' }),
      ).toBe(false)
      expect(
        set.allowsRepo({ collection: 'app.bsky.feed.post', action: 'create' }),
      ).toBe(false)
    })

    it('should ignore transition:generic', () => {
      const set = new ScopePermissions('transition:generic')
      expect(
        set.allowsRepo({ collection: 'app.bsky.feed.post', action: 'create' }),
      ).toBe(false)
      expect(
        set.allowsRepo({ collection: 'app.bsky.feed.post', action: 'delete' }),
      ).toBe(false)
      expect(
        set.allowsRepo({ collection: 'com.example.foo', action: 'create' }),
      ).toBe(false)
      expect(
        set.allowsRepo({ collection: 'com.example.foo', action: 'update' }),
      ).toBe(false)
    })
  })

  describe('allowsRpc', () => {
    it('should ignore "rpc:*?lxm=*"', () => {
      const set = new ScopePermissions('rpc:*?lxm=*')
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'com.example.method',
        }),
      ).toBe(false)
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'app.bsky.feed.getFeed',
        }),
      ).toBe(false)
    })

    it('should allow constraining "lxm"', () => {
      const set = new ScopePermissions('rpc:app.bsky.feed.getFeed?aud=*')
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'app.bsky.feed.getFeed',
        }),
      ).toBe(true)
      expect(
        set.allowsRpc({ aud: 'did:plc:blahbla', lxm: 'app.bsky.feed.getFeed' }),
      ).toBe(true)

      // Control

      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'com.example.method',
        }),
      ).toBe(false)
    })

    it('should allow constraining "aud"', () => {
      const set = new ScopePermissions('rpc:*?aud=did:web:example.com%23foo')
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com#foo',
          lxm: 'com.example.method',
        }),
      ).toBe(true)
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com#foo',
          lxm: 'app.bsky.feed.getFeed',
        }),
      ).toBe(true)

      // Control

      expect(
        set.allowsRpc({
          aud: 'did:web:bar.com#foo', // invalid aud (wrong service id)
          lxm: 'com.example.method',
        }),
      ).toBe(false)
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com', // invalid aud (no service id)
          lxm: 'com.example.method',
        }),
      ).toBe(false)
    })

    it('should allow constraining "lxm" and "aud"', () => {
      const set = new ScopePermissions(
        'rpc:app.bsky.feed.getFeed?aud=did:web:example.com%23foo',
      )
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com#foo',
          lxm: 'app.bsky.feed.getFeed',
        }),
      ).toBe(true)

      // Control

      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'com.example.method',
        }),
      ).toBe(false)
      expect(
        set.allowsRpc({ aud: 'did:plc:blahbla', lxm: 'app.bsky.feed.getFeed' }),
      ).toBe(false)
    })

    it('should ignore "transition:generic"', () => {
      const set = new ScopePermissions('transition:generic')
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'app.bsky.feed.getFeed',
        }),
      ).toBe(false)
      expect(
        set.allowsRpc({
          aud: 'did:web:example.com',
          lxm: 'com.example.method',
        }),
      ).toBe(false)
    })

    it('should ignore "transition:chat.bsky"', () => {
      const set = new ScopePermissions('transition:chat.bsky')
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
      ).toBe(false)
      expect(
        set.allowsRpc({ aud: 'did:web:example.com', lxm: 'com.example.foo' }),
      ).toBe(false)
    })
  })
})
