import { TestNetworkNoAppView } from '@atproto/dev-env'
import type { Client, DidString } from '@atproto/lex'
import { com } from '../src/lexicons/index.js'

const NSID = 'com.example.calendar.basePermissions'

const PERMISSION_SET_LEXICON = {
  lexicon: 1,
  id: NSID,
  defs: {
    main: {
      type: 'permission-set',
      title: 'Calendar',
      detail: 'Manage your events and RSVPs',
      permissions: [
        {
          type: 'permission',
          resource: 'repo',
          collection: ['com.example.calendar.event'],
        },
      ],
    },
  },
}

describe('oauth lexicon resolution', () => {
  let network: TestNetworkNoAppView
  let client: Client
  let authorityDid: DidString

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      pds: {
        // Enable SSRF protection so that the PDS cannot fetch lexicons from
        // itself over the network (plain "http://localhost" is rejected).
        // Lexicons hosted on this PDS must be resolved locally.
        disableSsrfProtection: false,
      },
    })
    client = network.pds.getClient()

    const sc = network.getSeedClient()
    const account = await sc.createAccount('authority', {
      handle: 'lex-authority.test',
      email: 'lex-authority@test.com',
      password: 'hunter2',
    })
    authorityDid = account.did

    await client.call(
      com.atproto.repo.createRecord,
      {
        repo: authorityDid,
        collection: 'com.atproto.lexicon.schema',
        rkey: NSID,
        record: PERMISSION_SET_LEXICON,
      },
      { headers: sc.getHeaders(authorityDid) },
    )

    // The authority DID is only known once the account exists, so point the
    // lexicon resolver at it after the fact (read on every resolution).
    network.pds.ctx.cfg.lexicon.didAuthority = authorityDid
  })

  afterAll(async () => {
    await network?.close()
  })

  const getLexiconManager = () => {
    const provider = network.pds.ctx.oauthProvider
    if (!provider) throw new Error('OAuth provider not enabled')
    return provider.lexiconManager
  }

  it('resolves permission sets hosted on the PDS itself', async () => {
    const permissionSets = await getLexiconManager().getPermissionSetsFromScope(
      `include:${NSID}`,
    )

    const permissionSet = permissionSets.get(NSID)
    expect(permissionSet?.type).toBe('permission-set')
    expect(permissionSet?.title).toBe('Calendar')
    expect(permissionSet?.permissions).toEqual(
      PERMISSION_SET_LEXICON.defs.main.permissions,
    )
  })

  it('fails to resolve lexicons that do not exist on the PDS', async () => {
    const nsid = 'com.example.calendar.missingPermissions'
    await expect(
      getLexiconManager().getPermissionSetsFromScope(`include:${nsid}`),
    ).rejects.toThrow(`Could not resolve Lexicon for NSID (${nsid})`)
  })
})
