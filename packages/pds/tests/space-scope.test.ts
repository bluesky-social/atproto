import { ScopeMissingError, ScopePermissions } from '@atproto/oauth-scopes'
import { DidString } from '@atproto/syntax'
import { assertSpaceScope } from '../src/api/com/atproto/space/util'
import {
  AccessOutput,
  OAuthOutput,
  SpaceCredentialOutput,
} from '../src/auth-output'
import { AuthScope } from '../src/auth-scope'

const SPACE = 'ats://did:plc:owner/com.atmoboards.forum/default'
const DID = 'did:plc:user' as DidString

const oauthAuth = (scope: string): OAuthOutput => ({
  credentials: {
    type: 'oauth',
    did: DID,
    permissions: new ScopePermissions(scope),
  },
})

const accessAuth = (): AccessOutput => ({
  credentials: {
    type: 'access',
    did: DID,
    scope: AuthScope.Access,
  },
})

const credentialAuth = (): SpaceCredentialOutput => ({
  credentials: {
    type: 'space_credential',
    iss: 'did:plc:owner',
    space: SPACE,
    clientId: 'test-client',
  },
})

describe('assertSpaceScope', () => {
  describe('legacy auth (no granular scope check)', () => {
    it('access tokens skip the scope check entirely', () => {
      // The handler-level helper is gated on credential type — legacy bearer
      // tokens predate granular permissions and are passed through.
      expect(() =>
        assertSpaceScope(accessAuth(), SPACE, { action: 'read' }),
      ).not.toThrow()
      expect(() =>
        assertSpaceScope(accessAuth(), SPACE, {
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).not.toThrow()
      expect(() =>
        assertSpaceScope(accessAuth(), SPACE, { action: 'manage' }),
      ).not.toThrow()
    })

    it('space credentials skip the scope check entirely', () => {
      // The credential is intrinsically scoped to its space; downstream
      // handlers do their own (auth.credentials.space === space) check.
      expect(() =>
        assertSpaceScope(credentialAuth(), SPACE, { action: 'read' }),
      ).not.toThrow()
    })
  })

  describe('OAuth — read', () => {
    it('passes when the grant covers the (type, did, skey) tuple', () => {
      const auth = oauthAuth('space:com.atmoboards.forum?did=did:plc:owner')
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read' }),
      ).not.toThrow()
    })

    it('passes with type wildcard', () => {
      const auth = oauthAuth('space:*?did=did:plc:owner')
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read' }),
      ).not.toThrow()
    })

    it('passes with did wildcard (modality grant)', () => {
      const auth = oauthAuth('space:com.atmoboards.forum')
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read' }),
      ).not.toThrow()
    })

    it('rejects when the type does not match', () => {
      const auth = oauthAuth('space:com.example.different')
      expect(() => assertSpaceScope(auth, SPACE, { action: 'read' })).toThrow(
        ScopeMissingError,
      )
    })

    it('rejects when the did does not match', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?did=did:plc:somebody-else',
      )
      expect(() => assertSpaceScope(auth, SPACE, { action: 'read' })).toThrow(
        ScopeMissingError,
      )
    })

    it('rejects when no space scope is present', () => {
      const auth = oauthAuth('atproto')
      expect(() => assertSpaceScope(auth, SPACE, { action: 'read' })).toThrow(
        ScopeMissingError,
      )
    })

    it('passes when the grant lists action=manage (manage implies read)', () => {
      const auth = oauthAuth('space:com.atmoboards.forum?action=manage')
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read' }),
      ).not.toThrow()
    })

    it('rejects when the grant explicitly excludes read', () => {
      // `?action=create` lists only create — read is not in the action list
      // and the grant does not include manage either.
      const auth = oauthAuth('space:com.atmoboards.forum?action=create')
      expect(() => assertSpaceScope(auth, SPACE, { action: 'read' })).toThrow(
        ScopeMissingError,
      )
    })
  })

  describe('OAuth — writes', () => {
    it('passes when action and collection are both covered', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?collection=com.atmoboards.thread&action=create',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).not.toThrow()
    })

    it('passes for any collection when collection=*', () => {
      const auth = oauthAuth('space:com.atmoboards.forum?collection=*')
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'update',
          collection: 'any.collection',
        }),
      ).not.toThrow()
    })

    it('rejects when the grant has no write targets (omitted collection)', () => {
      const auth = oauthAuth('space:com.atmoboards.forum')
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).toThrow(ScopeMissingError)
    })

    it('rejects when the action is not in the action list', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?collection=com.atmoboards.thread&action=create',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'delete',
          collection: 'com.atmoboards.thread',
        }),
      ).toThrow(ScopeMissingError)
    })

    it('rejects when the collection is not in the collection list', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?collection=com.atmoboards.thread',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'create',
          collection: 'com.atmoboards.reply',
        }),
      ).toThrow(ScopeMissingError)
    })

    it('rejects when action=read alone (read-only grant cannot write)', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?collection=com.atmoboards.thread&action=read',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).toThrow(ScopeMissingError)
    })
  })

  describe('OAuth — manage', () => {
    it('passes when the grant lists manage', () => {
      const auth = oauthAuth('space:com.atmoboards.forum?action=manage')
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'manage' }),
      ).not.toThrow()
    })

    it('passes with default action list (covers manage)', () => {
      const auth = oauthAuth('space:com.atmoboards.forum')
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'manage' }),
      ).not.toThrow()
    })

    it('rejects when the grant lists only writes (no manage, no read implies)', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?action=create&action=update',
      )
      expect(() => assertSpaceScope(auth, SPACE, { action: 'manage' })).toThrow(
        ScopeMissingError,
      )
    })

    it('rejects when the grant is read-only', () => {
      const auth = oauthAuth('space:com.atmoboards.forum?action=read')
      expect(() => assertSpaceScope(auth, SPACE, { action: 'manage' })).toThrow(
        ScopeMissingError,
      )
    })
  })

  describe('multiple scopes', () => {
    it('any matching scope satisfies the check', () => {
      // Two unrelated grants — only the second one matches. Should still pass.
      const auth = oauthAuth(
        'space:com.example.other space:com.atmoboards.forum?action=read',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read' }),
      ).not.toThrow()
    })

    it('multiple narrow grants combine correctly', () => {
      // Read on any forum; write to threads on this specific forum.
      const auth = oauthAuth(
        'space:com.atmoboards.forum?action=read space:com.atmoboards.forum?did=did:plc:owner&collection=com.atmoboards.thread&action=create',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read' }),
      ).not.toThrow()
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).not.toThrow()
      // But not delete — neither grant includes it.
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'delete',
          collection: 'com.atmoboards.thread',
        }),
      ).toThrow(ScopeMissingError)
    })
  })
})
