import { PermissionSet } from './permission-set.js'

describe('PermissionSet', () => {
  describe('allowsAccount', () => {
    it('should properly allow "account:email"', () => {
      const set = new PermissionSet('account:email')

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
      const set = new PermissionSet('transition:email')

      expect(set.allowsAccount({ attr: 'email', action: 'read' })).toBe(false)
      expect(set.allowsAccount({ attr: 'email', action: 'manage' })).toBe(false)
    })
  })

  describe('allowsBlob', () => {
    it('should allow any mime with "blob:*/*"', () => {
      const set = new PermissionSet('blob:*/*')
      expect(set.allowsBlob({ mime: 'image/png' })).toBe(true)
      expect(set.allowsBlob({ mime: 'application/json' })).toBe(true)
    })

    it('should only allow images with "blob:image/*"', () => {
      const set = new PermissionSet('blob:image/*')
      expect(set.allowsBlob({ mime: 'image/png' })).toBe(true)
      expect(set.allowsBlob({ mime: 'application/json' })).toBe(false)
    })

    it('should ignore invalid scope "blob:*"', () => {
      const set = new PermissionSet('blob:*')
      expect(set.allowsBlob({ mime: 'image/png' })).toBe(false)
      expect(set.allowsBlob({ mime: 'application/json' })).toBe(false)
    })

    it('should ignore invalid scope "blob:/image"', () => {
      const set = new PermissionSet('blob:/image')
      expect(set.allowsBlob({ mime: 'image/png' })).toBe(false)
      expect(set.allowsBlob({ mime: 'application/json' })).toBe(false)
    })

    it('should ignore "transition:generic"', () => {
      const set = new PermissionSet('transition:generic')
      expect(set.allowsBlob({ mime: 'image/png' })).toBe(false)
      expect(set.allowsBlob({ mime: 'application/json' })).toBe(false)
    })
  })

  describe('allowsRepo', () => {
    it('should allow any repo action with "repo:*"', () => {
      const set = new PermissionSet('repo:*')
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
      const set = new PermissionSet('repo:*?action=create')
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
      const set = new PermissionSet('repo:com.example.foo?action=create')
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
      const set = new PermissionSet('transition:generic')
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
      const set = new PermissionSet('rpc:*?lxm=*')
      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'com.example.method' }),
      ).toBe(false)
      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'app.bsky.feed.getFeed' }),
      ).toBe(false)
    })

    it('should allow constraining "lxm"', () => {
      const set = new PermissionSet('rpc:app.bsky.feed.getFeed?aud=*')
      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'app.bsky.feed.getFeed' }),
      ).toBe(true)
      expect(
        set.allowsRpc({ aud: 'did:plc:blahbla', lxm: 'app.bsky.feed.getFeed' }),
      ).toBe(true)

      // Control

      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'com.example.method' }),
      ).toBe(false)
    })

    it('should allow constraining "aud"', () => {
      const set = new PermissionSet('rpc:*?aud=did:example:123')
      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'com.example.method' }),
      ).toBe(true)
      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'app.bsky.feed.getFeed' }),
      ).toBe(true)

      // Control

      expect(
        set.allowsRpc({ aud: 'did:plc:blahbla', lxm: 'com.example.method' }),
      ).toBe(false)
    })

    it('should allow constraining "lxm" and "aud"', () => {
      const set = new PermissionSet(
        'rpc:app.bsky.feed.getFeed?aud=did:example:123',
      )
      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'app.bsky.feed.getFeed' }),
      ).toBe(true)

      // Control

      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'com.example.method' }),
      ).toBe(false)
      expect(
        set.allowsRpc({ aud: 'did:plc:blahbla', lxm: 'app.bsky.feed.getFeed' }),
      ).toBe(false)
    })

    it('should ignore "transition:generic"', () => {
      const set = new PermissionSet('transition:generic')
      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'app.bsky.feed.getFeed' }),
      ).toBe(false)
      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'com.example.method' }),
      ).toBe(false)
    })

    it('should ignore "transition:chat.bsky"', () => {
      const set = new PermissionSet('transition:chat.bsky')
      expect(
        set.allowsRpc({
          aud: 'did:example:123',
          lxm: 'chat.bsky.message.send',
        }),
      ).toBe(false)
      expect(
        set.allowsRpc({
          aud: 'did:example:123',
          lxm: 'chat.bsky.conversation.get',
        }),
      ).toBe(false)

      // Control

      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'app.bsky.feed.post' }),
      ).toBe(false)
      expect(
        set.allowsRpc({ aud: 'did:example:123', lxm: 'com.example.foo' }),
      ).toBe(false)
    })
  })
})
