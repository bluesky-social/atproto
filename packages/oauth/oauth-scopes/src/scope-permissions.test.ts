import { describe, expect, it } from 'vitest'
import type {
  DidString,
  NsidString,
  RecordKeyString,
  SpaceRefString,
} from '@atproto/syntax'
import { ScopeMissingError } from './scope-missing-error.js'
import { ScopePermissions } from './scope-permissions.js'

const SPACE =
  'at://did:plc:owner/space/com.atmoboards.forum/default' as SpaceRefString
const SPACE_REF = {
  spaceDid: 'did:plc:owner' as DidString,
  spaceType: 'com.atmoboards.forum' as NsidString,
  skey: 'default' as RecordKeyString,
}

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

  describe('assertRpc combined-aud', () => {
    it('allows did#serviceId aud when scope grants the same combined form', () => {
      const set = new ScopePermissions(
        'rpc:app.bsky.feed.getFeed?aud=did:web:example.com%23bsky_appview',
      )
      expect(() =>
        set.assertRpc({
          aud: 'did:web:example.com#bsky_appview',
          lxm: 'app.bsky.feed.getFeed',
        }),
      ).not.toThrow()
    })

    it('rejects bare-DID aud when scope grants a combined form', () => {
      const set = new ScopePermissions(
        'rpc:app.bsky.feed.getFeed?aud=did:web:example.com%23bsky_appview',
      )
      expect(() =>
        set.assertRpc({
          aud: 'did:web:example.com',
          lxm: 'app.bsky.feed.getFeed',
        }),
      ).toThrow()
    })

    it('allows wildcard aud against a combined-form match', () => {
      const set = new ScopePermissions('rpc:app.bsky.feed.getFeed?aud=*')
      expect(() =>
        set.assertRpc({
          aud: 'did:web:example.com#bsky_appview',
          lxm: 'app.bsky.feed.getFeed',
        }),
      ).not.toThrow()
    })
  })

  describe('assertSpace', () => {
    describe('OAuth — read', () => {
      it('passes when the grant covers the (type, authority, skey) tuple', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=did:plc:owner',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read',
          }),
        ).not.toThrow()
      })

      it('passes with type wildcard', () => {
        const set = new ScopePermissions('space:*?authority=did:plc:owner')
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read',
          }),
        ).not.toThrow()
      })

      it('passes with authority wildcard (any-authority grant)', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read',
          }),
        ).not.toThrow()
      })

      it('rejects a bare grant (authority defaults to self) against another owner', () => {
        // A bare `space:<type>` defaults authority to the granting user; it does
        // not cover a space owned by did:plc:owner.
        const set = new ScopePermissions('space:com.atmoboards.forum')
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read',
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when the type does not match', () => {
        const set = new ScopePermissions(
          'space:com.example.different?authority=*',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read',
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when the authority does not match', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=did:plc:somebody-else',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read',
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when no space scope is present', () => {
        const set = new ScopePermissions('atproto')
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read',
          }),
        ).toThrow(ScopeMissingError)
      })

      it('passes read_self when the grant has read (read implies read_self)', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&action=read',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read_self',
          }),
        ).not.toThrow()
      })

      it('rejects when the grant explicitly excludes read', () => {
        // `?action=create` lists only create — read is not in the action list
        // and the grant does not include manage either.
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&action=create',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read',
          }),
        ).toThrow(ScopeMissingError)
      })
    })

    describe('OAuth — writes', () => {
      it('passes when action and collection are both covered', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread&action=create',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'create',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).not.toThrow()
      })

      it('passes for any collection when collection=*', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&collection=*',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'update',
            collection: 'any.valid.collection' as NsidString,
          }),
        ).not.toThrow()
      })

      it('rejects when the grant has no write targets (omitted collection)', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'create',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when the action is not in the action list', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread&action=create',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'delete',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when the collection is not in the collection list', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'create',
            collection: 'com.atmoboards.reply' as NsidString,
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when action=read alone (read-only grant cannot write)', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread&action=read',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'create',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).toThrow(ScopeMissingError)
      })
    })

    describe('OAuth — manage', () => {
      it('passes when the grant lists the manage verb', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&manage=update',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            manage: 'update',
          }),
        ).not.toThrow()
      })

      it('rejects a different manage verb', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&manage=update',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            manage: 'delete',
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when the default grant has no manage verbs', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            manage: 'update',
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when the grant lists only record actions', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&action=create&action=update',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            manage: 'update',
          }),
        ).toThrow(ScopeMissingError)
      })
    })

    describe('multiple scopes', () => {
      it('any matching scope satisfies the check', () => {
        // Two unrelated grants — only the second one matches. Should still pass.
        const set = new ScopePermissions(
          'space:com.example.other space:com.atmoboards.forum?authority=*&action=read',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read',
          }),
        ).not.toThrow()
      })

      it('multiple narrow grants combine correctly', () => {
        // Read on any forum; write to threads on this specific forum.
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&action=read space:com.atmoboards.forum?authority=did:plc:owner&collection=com.atmoboards.thread&action=create',
        )
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'read',
          }),
        ).not.toThrow()
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'create',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).not.toThrow()
        // But not delete — neither grant includes it.
        expect(() =>
          set.assertSpace({
            type: SPACE_REF.spaceType,
            authority: SPACE_REF.spaceDid,
            skey: SPACE_REF.skey,
            action: 'delete',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).toThrow(ScopeMissingError)
      })
    })
  })

  describe('assertSpaceRef', () => {
    describe('OAuth — read', () => {
      it('passes when the grant covers the (type, authority, skey) tuple', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=did:plc:owner',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, { action: 'read' }),
        ).not.toThrow()
      })

      it('passes with type wildcard', () => {
        const set = new ScopePermissions('space:*?authority=did:plc:owner')
        expect(() =>
          set.assertSpaceRef(SPACE, { action: 'read' }),
        ).not.toThrow()
      })

      it('passes with authority wildcard (any-authority grant)', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, { action: 'read' }),
        ).not.toThrow()
      })

      it('rejects a bare grant (authority defaults to self) against another owner', () => {
        // A bare `space:<type>` defaults authority to the granting user; it does
        // not cover a space owned by did:plc:owner.
        const set = new ScopePermissions('space:com.atmoboards.forum')
        expect(() => set.assertSpaceRef(SPACE, { action: 'read' })).toThrow(
          ScopeMissingError,
        )
      })

      it('rejects when the type does not match', () => {
        const set = new ScopePermissions(
          'space:com.example.different?authority=*',
        )
        expect(() => set.assertSpaceRef(SPACE, { action: 'read' })).toThrow(
          ScopeMissingError,
        )
      })

      it('rejects when the authority does not match', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=did:plc:somebody-else',
        )
        expect(() => set.assertSpaceRef(SPACE, { action: 'read' })).toThrow(
          ScopeMissingError,
        )
      })

      it('rejects when no space scope is present', () => {
        const set = new ScopePermissions('atproto')
        expect(() => set.assertSpaceRef(SPACE, { action: 'read' })).toThrow(
          ScopeMissingError,
        )
      })

      it('passes read_self when the grant has read (read implies read_self)', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&action=read',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, { action: 'read_self' }),
        ).not.toThrow()
      })

      it('rejects when the grant explicitly excludes read', () => {
        // `?action=create` lists only create — read is not in the action list
        // and the grant does not include manage either.
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&action=create',
        )
        expect(() => set.assertSpaceRef(SPACE, { action: 'read' })).toThrow(
          ScopeMissingError,
        )
      })
    })

    describe('OAuth — writes', () => {
      it('passes when action and collection are both covered', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread&action=create',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, {
            action: 'create',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).not.toThrow()
      })

      it('passes for any collection when collection=*', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&collection=*',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, {
            action: 'update',
            collection: 'any.valid.collection' as NsidString,
          }),
        ).not.toThrow()
      })

      it('rejects when the grant has no write targets (omitted collection)', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, {
            action: 'create',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when the action is not in the action list', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread&action=create',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, {
            action: 'delete',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when the collection is not in the collection list', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, {
            action: 'create',
            collection: 'com.atmoboards.reply' as NsidString,
          }),
        ).toThrow(ScopeMissingError)
      })

      it('rejects when action=read alone (read-only grant cannot write)', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread&action=read',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, {
            action: 'create',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).toThrow(ScopeMissingError)
      })
    })

    describe('OAuth — manage', () => {
      it('passes when the grant lists the manage verb', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&manage=update',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, { manage: 'update' }),
        ).not.toThrow()
      })

      it('rejects a different manage verb', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&manage=update',
        )
        expect(() => set.assertSpaceRef(SPACE, { manage: 'delete' })).toThrow(
          ScopeMissingError,
        )
      })

      it('rejects when the default grant has no manage verbs', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*',
        )
        expect(() => set.assertSpaceRef(SPACE, { manage: 'update' })).toThrow(
          ScopeMissingError,
        )
      })

      it('rejects when the grant lists only record actions', () => {
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&action=create&action=update',
        )
        expect(() => set.assertSpaceRef(SPACE, { manage: 'update' })).toThrow(
          ScopeMissingError,
        )
      })
    })

    describe('multiple scopes', () => {
      it('any matching scope satisfies the check', () => {
        // Two unrelated grants — only the second one matches. Should still pass.
        const set = new ScopePermissions(
          'space:com.example.other space:com.atmoboards.forum?authority=*&action=read',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, { action: 'read' }),
        ).not.toThrow()
      })

      it('multiple narrow grants combine correctly', () => {
        // Read on any forum; write to threads on this specific forum.
        const set = new ScopePermissions(
          'space:com.atmoboards.forum?authority=*&action=read space:com.atmoboards.forum?authority=did:plc:owner&collection=com.atmoboards.thread&action=create',
        )
        expect(() =>
          set.assertSpaceRef(SPACE, { action: 'read' }),
        ).not.toThrow()
        expect(() =>
          set.assertSpaceRef(SPACE, {
            action: 'create',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).not.toThrow()
        // But not delete — neither grant includes it.
        expect(() =>
          set.assertSpaceRef(SPACE, {
            action: 'delete',
            collection: 'com.atmoboards.thread' as NsidString,
          }),
        ).toThrow(ScopeMissingError)
      })
    })
  })
})
