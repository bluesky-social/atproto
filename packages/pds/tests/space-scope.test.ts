import { ScopePermissions } from '@atproto/oauth-scopes'
import type { DidString } from '@atproto/syntax'
import { assertSpaceRead } from '../src/api/com/atproto/space/util.js'
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
