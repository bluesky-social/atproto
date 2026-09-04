import { ScopeMissingError, ScopePermissions } from '@atproto/oauth-scopes'
import type { DidString } from '@atproto/syntax'
import {
  assertSpaceRead,
  assertSpaceScope,
} from '../src/api/com/atproto/space/util.js'
import type {
  AccessOutput,
  OAuthOutput,
  SpaceCredentialOutput,
} from '../src/auth-output.js'
import { AuthScope } from '../src/auth-scope.js'

const SPACE = 'at://did:plc:owner/space/com.atmoboards.forum/default'
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
        assertSpaceScope(accessAuth(), SPACE, { manage: 'update' }),
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
    it('passes when the grant covers the (type, authority, skey) tuple', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=did:plc:owner',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read' }),
      ).not.toThrow()
    })

    it('passes with type wildcard', () => {
      const auth = oauthAuth('space:*?authority=did:plc:owner')
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read' }),
      ).not.toThrow()
    })

    it('passes with authority wildcard (any-authority grant)', () => {
      const auth = oauthAuth('space:com.atmoboards.forum?authority=*')
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read' }),
      ).not.toThrow()
    })

    it('rejects a bare grant (authority defaults to self) against another owner', () => {
      // A bare `space:<type>` defaults authority to the granting user; it does
      // not cover a space owned by did:plc:owner.
      const auth = oauthAuth('space:com.atmoboards.forum')
      expect(() => assertSpaceScope(auth, SPACE, { action: 'read' })).toThrow(
        ScopeMissingError,
      )
    })

    it('rejects when the type does not match', () => {
      const auth = oauthAuth('space:com.example.different?authority=*')
      expect(() => assertSpaceScope(auth, SPACE, { action: 'read' })).toThrow(
        ScopeMissingError,
      )
    })

    it('rejects when the authority does not match', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=did:plc:somebody-else',
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

    it('passes read_self when the grant has read (read implies read_self)', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=*&action=read',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read_self' }),
      ).not.toThrow()
    })

    it('rejects when the grant explicitly excludes read', () => {
      // `?action=create` lists only create — read is not in the action list
      // and the grant does not include manage either.
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=*&action=create',
      )
      expect(() => assertSpaceScope(auth, SPACE, { action: 'read' })).toThrow(
        ScopeMissingError,
      )
    })
  })

  describe('OAuth — writes', () => {
    it('passes when action and collection are both covered', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread&action=create',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).not.toThrow()
    })

    it('passes for any collection when collection=*', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=*&collection=*',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'update',
          collection: 'any.collection',
        }),
      ).not.toThrow()
    })

    it('rejects when the grant has no write targets (omitted collection)', () => {
      const auth = oauthAuth('space:com.atmoboards.forum?authority=*')
      expect(() =>
        assertSpaceScope(auth, SPACE, {
          action: 'create',
          collection: 'com.atmoboards.thread',
        }),
      ).toThrow(ScopeMissingError)
    })

    it('rejects when the action is not in the action list', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread&action=create',
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
        'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread',
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
        'space:com.atmoboards.forum?authority=*&collection=com.atmoboards.thread&action=read',
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
    it('passes when the grant lists the manage verb', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=*&manage=update',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, { manage: 'update' }),
      ).not.toThrow()
    })

    it('rejects a different manage verb', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=*&manage=update',
      )
      expect(() => assertSpaceScope(auth, SPACE, { manage: 'delete' })).toThrow(
        ScopeMissingError,
      )
    })

    it('rejects when the default grant has no manage verbs', () => {
      const auth = oauthAuth('space:com.atmoboards.forum?authority=*')
      expect(() => assertSpaceScope(auth, SPACE, { manage: 'update' })).toThrow(
        ScopeMissingError,
      )
    })

    it('rejects when the grant lists only record actions', () => {
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=*&action=create&action=update',
      )
      expect(() => assertSpaceScope(auth, SPACE, { manage: 'update' })).toThrow(
        ScopeMissingError,
      )
    })
  })

  describe('multiple scopes', () => {
    it('any matching scope satisfies the check', () => {
      // Two unrelated grants — only the second one matches. Should still pass.
      const auth = oauthAuth(
        'space:com.example.other space:com.atmoboards.forum?authority=*&action=read',
      )
      expect(() =>
        assertSpaceScope(auth, SPACE, { action: 'read' }),
      ).not.toThrow()
    })

    it('multiple narrow grants combine correctly', () => {
      // Read on any forum; write to threads on this specific forum.
      const auth = oauthAuth(
        'space:com.atmoboards.forum?authority=*&action=read space:com.atmoboards.forum?authority=did:plc:owner&collection=com.atmoboards.thread&action=create',
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

describe('assertSpaceRead', () => {
  const OTHER_DID = 'did:plc:other' as DidString

  it("reads the caller's own repo with only read_self", () => {
    const auth = oauthAuth(
      'space:com.atmoboards.forum?authority=*&action=read_self',
    )
    expect(() => assertSpaceRead(auth, SPACE, DID)).not.toThrow()
  })

  it('refuses another repo with only read_self', () => {
    const auth = oauthAuth(
      'space:com.atmoboards.forum?authority=*&action=read_self',
    )
    expect(() => assertSpaceRead(auth, SPACE, OTHER_DID)).toThrow(
      /Could not find repo/,
    )
  })

  it('refuses another repo even with whole-space read', () => {
    // `read` covers the caller's own repo and buys a delegation token; reaching
    // another member's repo takes a credential the authority issued.
    const auth = oauthAuth('space:com.atmoboards.forum?authority=*&action=read')
    expect(() => assertSpaceRead(auth, SPACE, DID)).not.toThrow()
    expect(() => assertSpaceRead(auth, SPACE, OTHER_DID)).toThrow(
      /Could not find repo/,
    )
  })

  it('refuses another repo on a legacy access token', () => {
    // Legacy tokens skip the scope check, so the self-only rule is the only
    // thing standing between an app password and another member's repo.
    expect(() => assertSpaceRead(accessAuth(), SPACE, DID)).not.toThrow()
    expect(() => assertSpaceRead(accessAuth(), SPACE, OTHER_DID)).toThrow(
      /Could not find repo/,
    )
  })

  it('read_self is not narrowed by collection', () => {
    const auth = oauthAuth(
      'space:com.atmoboards.forum?authority=*&action=read_self&collection=com.atmoboards.thread',
    )
    expect(() => assertSpaceRead(auth, SPACE, DID)).not.toThrow()
  })

  it('a space credential reads any repo in its own space', () => {
    const auth = credentialAuth()
    expect(() => assertSpaceRead(auth, SPACE, OTHER_DID)).not.toThrow()
    expect(() =>
      assertSpaceRead(
        auth,
        'at://did:plc:owner/space/com.atmoboards.forum/other',
        OTHER_DID,
      ),
    ).toThrow(/not scoped to this space/)
  })
})
