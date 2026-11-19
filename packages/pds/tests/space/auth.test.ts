import { decodeJwt } from 'jose'
import { P256Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { SeedClient, type TestNetworkNoAppView } from '@atproto/dev-env'
import { getBlobCidString } from '@atproto/lex-data'
import {
  createDelegationToken,
  createSpaceCredential,
  spaceHostAud,
} from '@atproto/space'
import type { DidString, NsidString, SpaceRefString } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { com } from '../../src/lexicons/index.js'
import {
  type AccountStatus,
  type Actor,
  type SpaceClient,
  SpaceCredential,
  TEST_COLLECTION,
  TEST_SPACE_TYPE,
  createSpaceNetwork,
} from '../_space.js'

// The collections dev-env's lexicon authority declares for TEST_SPACE_TYPE.
const SPACE_TYPE_COLLECTIONS = [
  'com.example.groupPost',
  'com.example.groupNote',
] as NsidString[]

const STATUSES: {
  status: AccountStatus
  repoError: string
  accountError: string
}[] = [
  {
    status: 'takendown',
    repoError: 'RepoTakendown',
    accountError: 'AccountTakedown',
  },
  {
    status: 'deactivated',
    repoError: 'RepoDeactivated',
    accountError: 'AccountDeactivated',
  },
]

describe('space auth', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor
  let dan: Actor
  let bob: Actor
  let carol: Actor

  beforeAll(async () => {
    // The lexicon authority lets the OAuth provider resolve TEST_SPACE_TYPE.
    ;({ network, sc, alice, dan, bob, carol } = await createSpaceNetwork({
      lexiconAuthority: true,
    }))
  })

  afterAll(async () => {
    await network?.close()
  })

  const uploadBlob = async (actor: Actor, bytes: Uint8Array) => {
    const { body } = await actor.client.uploadBlob(bytes, {
      headers: actor.headers,
      encoding: 'image/png',
    })
    return body.blob
  }

  describe('account tokens', () => {
    it("read only the account's own repo", async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      await sc.write(alice, space, { rkey: 'private' })

      const params = { space, repo: alice.did }
      const opts = { headers: dan.headers }
      const reads = [
        () =>
          dan.client.call(
            com.atproto.space.getRecord,
            { ...params, collection: TEST_COLLECTION, rkey: 'private' },
            opts,
          ),
        () => dan.client.call(com.atproto.space.listRecords, params, opts),
        () => dan.client.call(com.atproto.space.listRepoOps, params, opts),
        () => dan.client.call(com.atproto.space.getLatestCommit, params, opts),
        () => dan.client.xrpc(com.atproto.space.getRepo, { params, ...opts }),
      ]
      for (const read of reads) {
        await expect(read()).rejects.toMatchObject({ error: 'RepoNotFound' })
      }
    })

    it('are refused for an app password, even a privileged one', async () => {
      const space = await sc.createSpace(alice)
      await sc.write(alice, space)
      const { password } = await alice.client.call(
        com.atproto.server.createAppPassword,
        { name: 'space', privileged: true },
        { headers: alice.headers },
      )
      const { accessJwt } = await alice.client.call(
        com.atproto.server.createSession,
        { identifier: alice.did, password },
      )
      const headers = SeedClient.getHeaders(accessJwt)

      const calls = [
        () =>
          alice.client.call(
            com.atproto.space.createSpace,
            {
              spaceType: TEST_SPACE_TYPE,
              policy: com.atproto.memberspace.policy.$build({}),
            },
            { headers },
          ),
        () =>
          alice.client.call(com.atproto.space.getSpace, { space }, { headers }),
        () =>
          alice.client.call(
            com.atproto.memberspace.putMembers,
            { space, members: [{ did: carol.did, read: true, write: true }] },
            { headers },
          ),
        () => sc.write(alice, space, { headers }),
        () =>
          alice.client.call(
            com.atproto.space.listRecords,
            { space, repo: alice.did },
            { headers },
          ),
        () =>
          alice.client.call(
            com.atproto.space.getDelegationToken,
            { space },
            { headers },
          ),
      ]
      for (const call of calls) {
        await expect(call()).rejects.toMatchObject({
          error: 'InvalidToken',
          message: 'Bad token scope',
        })
      }
    })
  })

  describe('space credentials', () => {
    it('read member repos on any host', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      await sc.write(alice, space, { text: 'alice' })
      await sc.write(bob, space, { text: 'bob' })

      const cred = await sc.credentialFor(carol, space)
      for (const host of [alice, bob]) {
        const { records } = await cred
          .clientFor(host.pds)
          .call(com.atproto.space.listRecords, { space, repo: host.did })
        expect(records).toMatchObject([{ value: { text: host.name } }])
      }
    })

    it('are scoped to one space', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const other = await sc.createSpace(alice)
      await sc.write(alice, other)

      const cred = await sc.credentialFor(carol, space)
      await expect(
        cred.clientFor(alice.pds).call(com.atproto.space.listRecords, {
          space: other,
          repo: alice.did,
        }),
      ).rejects.toMatchObject({ error: 'InvalidCredential' })
    })

    it('are refused unless issued by the space authority', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      await sc.write(alice, space)

      const key = await P256Keypair.create()
      const forged = new SpaceCredential(
        await createSpaceCredential({
          iss: carol.did,
          sub: space,
          keyId: key.did() as DidString,
          keypair: await carol.pds.ctx.actorStore.keypair(carol.did),
        }),
        key,
        sc.idResolver,
      )
      await expect(
        forged.clientFor(alice.pds).call(com.atproto.space.listRecords, {
          space,
          repo: alice.did,
        }),
      ).rejects.toMatchObject({ error: 'BadJwtIss' })
    })

    it("are refused unless signed by the issuer's key", async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      await sc.write(alice, space)

      const key = await P256Keypair.create()
      const forged = new SpaceCredential(
        await createSpaceCredential({
          iss: alice.did,
          sub: space,
          keyId: key.did() as DidString,
          keypair: await Secp256k1Keypair.create(),
        }),
        key,
        sc.idResolver,
      )
      await expect(
        forged.clientFor(alice.pds).call(com.atproto.space.listRecords, {
          space,
          repo: alice.did,
        }),
      ).rejects.toMatchObject({ error: 'BadJwtSignature' })
    })

    describe('HTTP message signatures', () => {
      let space: SpaceRefString
      let cred: SpaceCredential

      beforeAll(async () => {
        space = await sc.createSpace(alice, { members: [carol] })
        await sc.write(alice, space)
        cred = await sc.credentialFor(carol, space)
      })

      const listRecords = (headers: Record<string, string>) =>
        alice.client.call(
          com.atproto.space.listRecords,
          { space, repo: alice.did },
          { headers },
        )

      it('are required to present a credential', async () => {
        await expect(
          listRecords({ authorization: `Bearer ${cred.credential}` }),
        ).rejects.toMatchObject({ error: 'InvalidToken' })

        const {
          signature,
          'signature-input': _,
          ...unsigned
        } = await cred.signedHeaders(alice.did)
        await expect(listRecords(unsigned)).rejects.toMatchObject({
          error: 'BadSpaceSignature',
        })
      })

      it('accept the credential scheme in any case', async () => {
        const headers = await cred.signedHeaders(alice.did, {
          scheme: 'atproto-space-credential',
        })
        await expect(listRecords(headers)).resolves.toMatchObject({
          records: [expect.anything()],
        })
      })

      it('refuse a repeated audience', async () => {
        const headers = await cred.signedHeaders(alice.did)
        headers['atproto-space-audience'] = `${alice.did}, ${alice.did}`
        await expect(listRecords(headers)).rejects.toMatchObject({
          error: 'BadSpaceSignature',
        })
      })

      it('must be made with the key the credential binds', async () => {
        const rebound = new SpaceCredential(
          cred.credential,
          await P256Keypair.create(),
          sc.idResolver,
        )
        await expect(
          listRecords(await rebound.signedHeaders(alice.did)),
        ).rejects.toMatchObject({ error: 'BadSpaceSignature' })
      })

      it('must name the repo read as audience', async () => {
        await expect(
          listRecords(await cred.signedHeaders(dan.did)),
        ).rejects.toMatchObject({ error: 'BadSpaceAudience' })
      })

      it('must name the authority as audience for space-host methods', async () => {
        await expect(
          alice.client.call(
            com.atproto.space.listWriters,
            { space },
            { headers: await cred.signedHeaders(carol.did) },
          ),
        ).rejects.toMatchObject({ error: 'BadSpaceAudience' })
      })

      it('can be reused for the same audience', async () => {
        const headers = await cred.signedHeaders(alice.did)
        await expect(listRecords(headers)).resolves.toMatchObject({
          records: [expect.anything()],
        })
        await expect(
          alice.client.call(
            com.atproto.space.listWriters,
            { space },
            { headers },
          ),
        ).resolves.toMatchObject({ repos: [expect.anything()] })
      })
    })
  })

  describe('credential revocation', () => {
    // The authority sends revocations to each repo host; here, bob's.
    const revoke = async (
      space: SpaceRefString,
      jtis: string[],
      opts: { iss?: Actor; aud?: DidString } = {},
    ) => {
      const iss = opts.iss ?? alice
      const { headers } = await createServiceAuthHeaders({
        iss: iss.did,
        aud: opts.aud ?? bob.did,
        lxm: com.atproto.space.notifyCredentialsRevoked.$lxm,
        keypair: await iss.pds.ctx.actorStore.keypair(iss.did),
      })
      return bob.client.call(
        com.atproto.space.notifyCredentialsRevoked,
        { space, credentials: jtis },
        { headers },
      )
    }

    const jti = (cred: SpaceCredential) => decodeJwt(cred.credential).jti!

    const readBob = (cred: SpaceCredential, space: SpaceRefString) =>
      cred
        .clientFor(bob.pds)
        .call(com.atproto.space.listRecords, { space, repo: bob.did })

    it('refuses a revoked credential, and accepts a repeated revocation', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      await sc.write(bob, space)
      const revoked = await sc.credentialFor(carol, space)
      const untouched = await sc.credentialFor(carol, space)

      await revoke(space, [jti(revoked)])
      await revoke(space, [jti(revoked)])

      await expect(readBob(revoked, space)).rejects.toMatchObject({
        error: 'CredentialRevoked',
      })
      await expect(readBob(untouched, space)).resolves.toMatchObject({
        records: [expect.anything()],
      })
    })

    it('requires the space authority as issuer', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await expect(
        revoke(space, ['some-jti'], { iss: carol }),
      ).rejects.toMatchObject({
        error: 'Forbidden',
        message: 'Revocation issuer is not the space authority',
      })
    })

    it('requires a repo hosted here as audience', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      await expect(
        revoke(space, ['some-jti'], { aud: carol.did }),
      ).rejects.toMatchObject({
        error: 'Forbidden',
        message: 'Revocation audience does not match a repo hosted here',
      })
    })

    it('is scoped to the space', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      const other = await sc.createSpace(alice)
      await sc.write(bob, space)
      const cred = await sc.credentialFor(bob, space)

      await revoke(other, [jti(cred)])
      await expect(readBob(cred, space)).resolves.toMatchObject({
        records: [expect.anything()],
      })
    })
  })

  describe('delegation tokens', () => {
    it('are answered SpaceNotFound by a host that is not the authority', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const token = await sc.delegationTokenFor(carol, space)
      const key = await P256Keypair.create()
      await expect(
        bob.client.call(com.atproto.space.authorizeSpaceSync, {
          space,
          credentialKey: key.did(),
          delegationToken: token,
        }),
      ).rejects.toMatchObject({ error: 'SpaceNotFound' })
    })

    it('are refused for a credential key that is not P-256', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const token = await sc.delegationTokenFor(carol, space)
      const key = await Secp256k1Keypair.create()
      await expect(
        alice.client.call(com.atproto.space.authorizeSpaceSync, {
          space,
          credentialKey: key.did(),
          delegationToken: token,
        }),
      ).rejects.toMatchObject({ error: 'InvalidRequest' })
    })

    it('are refused when addressed to another authority', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const delegationToken = await createDelegationToken({
        iss: carol.did,
        sub: space,
        aud: spaceHostAud(bob.did),
        keypair: await carol.pds.ctx.actorStore.keypair(carol.did),
      })
      await expect(
        sc.authorize(space, { delegationToken }),
      ).rejects.toMatchObject({ error: 'InvalidDelegationToken' })
    })

    it('are single-use', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const delegationToken = await sc.delegationTokenFor(carol, space)

      await sc.authorize(space, { delegationToken })
      await expect(
        sc.authorize(space, { delegationToken }),
      ).rejects.toMatchObject({ error: 'InvalidDelegationToken' })
    })

    it('are refused for a space other than their subject', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const other = await sc.createSpace(alice, { members: [carol] })
      const delegationToken = await sc.delegationTokenFor(carol, space)

      await expect(
        sc.authorize(other, { delegationToken }),
      ).rejects.toMatchObject({ error: 'InvalidDelegationToken' })
    })
  })

  describe('account status', () => {
    it('stops serving a taken-down repo', async () => {
      const space = await sc.createSpace(alice, { members: [dan, carol] })
      await sc.write(dan, space)
      const cred = await sc.credentialFor(carol, space)
      const listOps = () =>
        cred
          .clientFor(dan.pds)
          .call(com.atproto.space.listRepoOps, { space, repo: dan.did })

      {
        await using _ = await sc.withStatus(dan, 'takendown')
        await expect(listOps()).rejects.toMatchObject({
          error: 'RepoTakendown',
        })
      }
      await expect(listOps()).resolves.toMatchObject({
        ops: [expect.anything()],
      })
    })

    it('stops writes and delegation tokens for a taken-down account', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })

      await using _ = await sc.withStatus(dan, 'takendown')
      await expect(sc.write(dan, space)).rejects.toMatchObject({
        error: 'AccountTakedown',
      })
      await expect(sc.delegationTokenFor(dan, space)).rejects.toMatchObject({
        error: 'AccountTakedown',
      })
    })

    it.each(STATUSES)(
      'stops minting credentials and listing writers for a $status authority',
      async ({ status, repoError }) => {
        const authority = await sc.createActor(`host-${status.slice(0, 5)}`)
        const space = await sc.createSpace(authority, { members: [dan] })
        const cred = await sc.credentialFor(dan, space)

        await using _ = await sc.withStatus(authority, status)
        await expect(sc.credentialFor(dan, space)).rejects.toMatchObject({
          error: repoError,
        })
        await expect(sc.authorize(space)).rejects.toMatchObject({
          error: repoError,
        })
        await expect(
          cred
            .clientFor(authority.pds)
            .call(com.atproto.space.listWriters, { space }),
        ).rejects.toMatchObject({ error: repoError })
      },
    )

    it.each(STATUSES)(
      'stops a $status authority managing its spaces',
      async ({ status, accountError }) => {
        const authority = await sc.createActor(`mgr-${status.slice(0, 5)}`)
        const space = await sc.createSpace(authority, { members: [dan] })
        const policy = com.atproto.memberspace.policy.$build({})
        const opts = { headers: authority.headers }
        const calls = [
          () => sc.createSpace(authority),
          () =>
            authority.client.call(
              com.atproto.space.updateSpace,
              { space, policy },
              opts,
            ),
          () =>
            authority.client.call(
              com.atproto.space.deleteSpace,
              { space },
              opts,
            ),
          () => sc.removeWriter(authority, space, dan),
          () => sc.putMember(authority, space, bob),
          () => sc.removeMember(authority, space, dan),
        ]

        await using _ = await sc.withStatus(authority, status)
        for (const call of calls) {
          await expect(call()).rejects.toMatchObject({ error: accountError })
        }
      },
    )

    it('lets an admin read a taken-down repo', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const bytes = new Uint8Array([1, 2, 3])
      const blob = await uploadBlob(dan, bytes)
      await sc.write(dan, space, {
        rkey: 'admin-read',
        record: { $type: TEST_COLLECTION, text: 'hi', image: blob },
      })

      await using _ = await sc.withStatus(dan, 'takendown')
      const client = network.pds.getClient()
      const headers = network.pds.adminAuthHeaders()
      const params = { space, repo: dan.did }
      const cid = getBlobCidString(blob)

      await expect(
        client.call(
          com.atproto.space.getRecord,
          { ...params, collection: TEST_COLLECTION, rkey: 'admin-read' },
          { headers },
        ),
      ).resolves.toMatchObject({ value: { text: 'hi' } })
      await expect(
        client.call(com.atproto.space.listRecords, params, { headers }),
      ).resolves.toMatchObject({ records: [expect.anything()] })
      await expect(
        client.call(com.atproto.space.listBlobs, params, { headers }),
      ).resolves.toMatchObject({ cids: [cid] })
      await expect(
        client.call(com.atproto.space.listRepoOps, params, { headers }),
      ).resolves.toMatchObject({ ops: [expect.anything()] })
      await expect(
        client.call(com.atproto.space.getLatestCommit, params, { headers }),
      ).resolves.toMatchObject({ commit: { repo: dan.did } })
      await expect(
        client.xrpc(com.atproto.space.getRepo, { params, headers }),
      ).resolves.toMatchObject({ status: 200 })
      await expect(
        client.xrpc(com.atproto.space.getBlob, {
          params: { ...params, cid },
          headers,
        }),
      ).resolves.toMatchObject({ body: bytes })
    })

    it('lets a taken-down account export its spaces', async () => {
      const josie = await sc.createActor('josie')
      const space = await sc.createSpace(josie)
      const bytes = new Uint8Array([4, 5, 6])
      const blob = await uploadBlob(josie, bytes)
      await sc.write(josie, space, {
        record: { $type: TEST_COLLECTION, text: 'hi', image: blob },
      })

      await using _ = await sc.withStatus(josie, 'takendown')
      const { accessJwt } = await josie.client.call(
        com.atproto.server.createSession,
        {
          identifier: josie.did,
          password: josie.password,
          allowTakendown: true,
        },
      )
      const headers = SeedClient.getHeaders(accessJwt)
      const params = { space, repo: josie.did }
      const cid = getBlobCidString(blob)

      await expect(
        josie.client.call(com.atproto.space.listSpaces, {}, { headers }),
      ).resolves.toMatchObject({ spaces: [{ space }] })
      await expect(
        josie.client.xrpc(com.atproto.space.exportSpaceMeta, {
          params: { space },
          headers,
        }),
      ).resolves.toMatchObject({ status: 200 })
      await expect(
        josie.client.xrpc(com.atproto.space.getRepo, { params, headers }),
      ).resolves.toMatchObject({ status: 200 })
      await expect(
        josie.client.call(com.atproto.space.listBlobs, params, { headers }),
      ).resolves.toMatchObject({ cids: [cid] })
      await expect(
        josie.client.xrpc(com.atproto.space.getBlob, {
          params: { ...params, cid },
          headers,
        }),
      ).resolves.toMatchObject({ body: bytes })

      // Nothing beyond export.
      await expect(
        josie.client.call(com.atproto.space.listRecords, params, { headers }),
      ).rejects.toMatchObject({ error: 'InvalidToken' })
      await expect(sc.write(josie, space, { headers })).rejects.toMatchObject({
        error: 'InvalidToken',
      })
    })

    it('refuses a space record as a takedown subject', async () => {
      const space = await sc.createSpace(alice)
      const { uri, cid } = await sc.write(alice, space)
      await expect(
        alice.client.call(
          com.atproto.admin.updateSubjectStatus,
          {
            subject: com.atproto.repo.strongRef.$build({ uri, cid }),
            takedown: { applied: true },
          },
          { headers: network.pds.adminAuthHeaders() },
        ),
      ).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: 'Space records cannot be taken down',
      })
    })

    it('reports a space record as not taken down', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const { uri, cid } = await sc.write(dan, space)
      await expect(
        dan.client.call(
          com.atproto.admin.getSubjectStatus,
          { uri },
          { headers: network.pds.adminAuthHeaders() },
        ),
      ).resolves.toEqual({
        subject: com.atproto.repo.strongRef.$build({ uri, cid }),
        takedown: { applied: false },
      })
    })
  })

  describe('OAuth scopes', () => {
    const grant = (params: string, spaceDid = alice.did) =>
      `atproto space:${TEST_SPACE_TYPE}?spaceDid=${spaceDid}&${params}`

    it('enforces the collection a grant names', async () => {
      const space = await sc.createSpace(alice)
      const [allowed, forbidden] = SPACE_TYPE_COLLECTIONS

      using oauth = sc.asOAuth(
        alice,
        grant(`collection=${allowed}&action=create`),
      )
      const { headers } = oauth
      await expect(
        sc.write(alice, space, { collection: allowed, headers }),
      ).resolves.toMatchObject({ uri: expect.any(String) })
      await expect(
        sc.write(alice, space, { collection: forbidden, headers }),
      ).rejects.toMatchObject({ error: 'ScopeMissingError' })
    })

    it('enforces the action a grant names', async () => {
      const space = await sc.createSpace(alice)
      const [collection] = SPACE_TYPE_COLLECTIONS
      await sc.write(alice, space, { collection, rkey: 'seeded' })

      using oauth = sc.asOAuth(
        alice,
        grant(`collection=${collection}&action=create`),
      )
      await expect(
        sc.del(alice, space, {
          collection,
          rkey: 'seeded',
          headers: oauth.headers,
        }),
      ).rejects.toMatchObject({ error: 'ScopeMissingError' })
    })

    it('requires delete on every collection a clear removes', async () => {
      const space = await sc.createSpace(alice)
      const [first, second] = SPACE_TYPE_COLLECTIONS
      await sc.write(alice, space, { collection: first })
      await sc.write(alice, space, { collection: second })

      {
        using oauth = sc.asOAuth(
          alice,
          grant(`collection=${first}&action=delete`),
        )
        await expect(
          sc.clear(alice, space, { headers: oauth.headers }),
        ).rejects.toMatchObject({ error: 'ScopeMissingError' })
      }
      {
        using oauth = sc.asOAuth(
          alice,
          grant(`collection=${first}&collection=${second}&action=delete`),
        )
        await expect(
          sc.clear(alice, space, { headers: oauth.headers }),
        ).resolves.toEqual({})
      }
    })

    it('resolves putRecord to update for an existing record', async () => {
      const space = await sc.createSpace(alice)
      const [collection] = SPACE_TYPE_COLLECTIONS
      await sc.write(alice, space, { collection, rkey: 'self' })

      using oauth = sc.asOAuth(
        alice,
        grant(`collection=${collection}&action=update`),
      )
      const { headers } = oauth
      await expect(
        sc.put(alice, space, { collection, rkey: 'self', headers }),
      ).resolves.toMatchObject({ uri: expect.any(String) })
      await expect(
        sc.put(alice, space, { collection, rkey: 'fresh', headers }),
      ).rejects.toMatchObject({ error: 'ScopeMissingError' })
    })

    it('enforces the space type and authority a grant names', async () => {
      const otherType = await sc.createSpace(alice, {
        spaceType: 'com.example.otherGroup' as NsidString,
      })
      const otherAuthority = await sc.createSpace(dan)

      {
        using oauth = sc.asOAuth(alice, grant('collection=*&action=create'))
        await expect(
          sc.write(alice, otherType, { headers: oauth.headers }),
        ).rejects.toMatchObject({ error: 'ScopeMissingError' })
      }
      {
        using oauth = sc.asOAuth(dan, grant('collection=*&action=create'))
        await expect(
          sc.write(dan, otherAuthority, { headers: oauth.headers }),
        ).rejects.toMatchObject({ error: 'ScopeMissingError' })
      }
    })

    it('exchanges only a whole-space read grant for a delegation token', async () => {
      const space = await sc.createSpace(alice)
      await sc.write(alice, space)
      const getDelegationToken = (headers: { authorization: string }) =>
        alice.client.call(
          com.atproto.space.getDelegationToken,
          { space },
          { headers },
        )

      {
        using oauth = sc.asOAuth(alice, grant('action=read_self'))
        await expect(
          alice.client.call(
            com.atproto.space.listRecords,
            { space, repo: alice.did },
            { headers: oauth.headers },
          ),
        ).resolves.toMatchObject({ records: [expect.anything()] })
        await expect(getDelegationToken(oauth.headers)).rejects.toMatchObject({
          error: 'ScopeMissingError',
        })
      }
      {
        using oauth = sc.asOAuth(alice, grant('action=read'))
        await expect(getDelegationToken(oauth.headers)).resolves.toMatchObject({
          token: expect.any(String),
        })
      }
    })

    it('requires a wildcard grant to list spaces unfiltered', async () => {
      const space = await sc.createSpace(alice)

      using oauth = sc.asOAuth(alice, grant('action=read_self'))
      const { headers } = oauth
      await expect(
        alice.client.call(com.atproto.space.listSpaces, {}, { headers }),
      ).rejects.toMatchObject({ error: 'ScopeMissingError' })
      const { spaces } = await alice.client.call(
        com.atproto.space.listSpaces,
        { spaceType: TEST_SPACE_TYPE, spaceDid: alice.did },
        { headers },
      )
      expect(spaces.map((s) => s.space)).toContain(space)
    })

    it('enforces the manage operations a grant names', async () => {
      const space = await sc.createSpace(alice)
      const update = (headers: { authorization: string }) =>
        alice.client.call(
          com.atproto.space.updateSpace,
          { space, policy: com.atproto.memberspace.policy.$build({}) },
          { headers },
        )

      {
        using oauth = sc.asOAuth(alice, grant('collection=*'))
        await expect(update(oauth.headers)).rejects.toMatchObject({
          error: 'ScopeMissingError',
        })
      }
      {
        using oauth = sc.asOAuth(alice, grant('manage=update'))
        await expect(update(oauth.headers)).resolves.toBeUndefined()
      }
    })

    it('accepts the collections the provider materializes for a bare grant', async () => {
      const space = await sc.createSpace(alice)
      const scope =
        await network.pds.ctx.oauthProvider!.lexiconManager.buildTokenScope(
          `space:${TEST_SPACE_TYPE}`,
          alice.did,
        )

      using oauth = sc.asOAuth(alice, `atproto ${scope}`)
      const { headers } = oauth
      for (const collection of SPACE_TYPE_COLLECTIONS) {
        await expect(
          sc.write(alice, space, { collection, headers }),
        ).resolves.toMatchObject({ uri: expect.any(String) })
      }
      await expect(sc.write(alice, space, { headers })).rejects.toMatchObject({
        error: 'ScopeMissingError',
      })
    })
  })
})
