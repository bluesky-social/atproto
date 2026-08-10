import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { JoseKey } from '@atproto/oauth-provider/provider'
import { createDpopProof, createSpaceToken, spaceHostAud } from '@atproto/space'
import type { NsidString } from '@atproto/syntax'
import { com } from '../../src/lexicons/index.js'
import {
  type Actor,
  SPACE_TYPE_COLLECTIONS,
  SpaceClient,
  SpaceCredential,
  TEST_COLLECTION,
  TEST_SPACE_TYPE,
  record,
} from '../_space.js'

/**
 * Who may read what, and on whose authority.
 *
 * Two credential kinds reach a space. An account's own token (OAuth or legacy)
 * reads only that account's own repo — a repo host has no member list to consult.
 * A *space credential*, which only the authority mints and only after deciding the
 * holder may read the space, reads any repo in it. The exchange between them is
 * the delegation token.
 */
describe('space auth', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor // authority
  let dan: Actor // co-located with the authority, on pds1
  let bob: Actor // on pds2
  let carol: Actor // on pds3

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'space_auth',
      extraPdses: 2,
      // A `space` lexicon has to resolve for the OAuth suite below, which asserts
      // the space type's declared collections get materialized into a grant.
      lexiconAuthority: true,
    })
    sc = new SpaceClient(network)
    alice = await sc.createActor('alice', network.pds)
    dan = await sc.createActor('dan', network.pds)
    bob = await sc.createActor('bob', network.extraPdses[0], 'test2')
    carol = await sc.createActor('carol', network.extraPdses[1], 'test3')
  })

  afterAll(async () => {
    await network?.close()
  })

  describe('the repo boundary', () => {
    it('refuses a co-located non-member reading a member repo', async () => {
      // Alice and dan share pds1. Dan is not a member; the membership gate lives
      // in getSpaceCredential, so the read methods have to refuse him on their
      // own rather than assuming an unauthorized caller never got this far.
      const space = await sc.createSpace(alice)
      await sc.write(alice, space, { rkey: 'private', text: 'members only' })

      const reads = [
        () =>
          dan.client.call(
            com.atproto.space.getRecord,
            {
              space,
              repo: alice.did,
              collection: TEST_COLLECTION,
              rkey: 'private',
            },
            { headers: dan.headers },
          ),
        () =>
          dan.client.call(
            com.atproto.space.listRecords,
            { space, repo: alice.did },
            { headers: dan.headers },
          ),
        () =>
          dan.client.call(
            com.atproto.space.listRepoOps,
            { space, repo: alice.did },
            { headers: dan.headers },
          ),
        () =>
          dan.client.call(
            com.atproto.space.getLatestCommit,
            { space, repo: alice.did },
            { headers: dan.headers },
          ),
      ]
      for (const read of reads) {
        // Deliberately the same error an absent repo gets: whether a given
        // account holds a repo in a space the caller can't read is not the
        // caller's business.
        await expect(read()).rejects.toMatchObject({ error: 'RepoNotFound' })
      }

      const carRes = await fetch(
        `${network.pds.url}/xrpc/com.atproto.space.getRepo?space=${encodeURIComponent(space)}&repo=${alice.did}`,
        { headers: dan.headers },
      )
      expect(carRes.status).toBe(400)

      // Alice reads her own repo in the same space, so the refusal is about the
      // repo boundary rather than the space being unreadable.
      const own = await alice.client.call(
        com.atproto.space.listRecords,
        { space, repo: alice.did },
        { headers: alice.headers },
      )
      expect(own.records).toHaveLength(1)
    })

    it('refuses to mint a delegation token on an app password', async () => {
      // An app password carries no space grants to bound it by, and a delegation
      // token buys whole-space read. Records it may still write.
      const space = await sc.createSpace(alice)
      const agent = network.pds.getAgent()
      const { data: created } =
        await agent.com.atproto.server.createAppPassword(
          { name: 'space-pass' },
          { headers: alice.headers, encoding: 'application/json' },
        )
      const { data: session } = await agent.com.atproto.server.createSession({
        identifier: alice.did,
        password: created.password,
      })
      const appPass = SeedClient.getHeaders(session.accessJwt)

      await expect(
        alice.client.call(
          com.atproto.space.getDelegationToken,
          { space },
          { headers: appPass },
        ),
      ).rejects.toThrow()

      await expect(
        alice.client.call(
          com.atproto.space.createRecord,
          {
            space,
            repo: alice.did,
            collection: TEST_COLLECTION,
            record: record(TEST_COLLECTION, 'from an app password'),
          },
          { headers: appPass },
        ),
      ).resolves.toBeDefined()
    })
  })

  describe('space credentials', () => {
    it('reads another member repo across PDSes', async () => {
      const space = await sc.createSpace(alice, { members: [bob, carol] })
      await sc.write(bob, space, { text: 'for the record' })

      // Read on pds2 with a credential minted on pds1: neither is the authority.
      const cred = await sc.credentialFor(carol, space)
      const asSyncer = cred.clientFor(bob.pds)
      const list = await asSyncer.call(com.atproto.space.listRecords, {
        space,
        repo: bob.did,
        collection: TEST_COLLECTION,
      })
      expect(list.records).toHaveLength(1)

      const rec = await asSyncer.call(com.atproto.space.getRecord, {
        space,
        repo: bob.did,
        collection: TEST_COLLECTION,
        rkey: list.records[0].rkey,
      })
      expect(rec.value).toMatchObject({ text: 'for the record' })
    })

    describe('DPoP binding', () => {
      it('refuses a credential presented as a bearer token', async () => {
        const space = await sc.createSpace(alice, { members: [carol] })
        await sc.write(alice, space, { text: 'bound' })

        const cred = await sc.credentialFor(carol, space)
        await expect(
          alice.client.call(
            com.atproto.space.getLatestCommit,
            { space, repo: alice.did },
            { headers: { authorization: `Bearer ${cred.credential}` } },
          ),
        ).rejects.toThrow()

        await expect(
          cred.clientFor(alice.pds).call(com.atproto.space.getLatestCommit, {
            space,
            repo: alice.did,
          }),
        ).resolves.toBeDefined()
      })

      it('refuses a credential without a proof', async () => {
        const space = await sc.createSpace(alice, { members: [carol] })
        const cred = await sc.credentialFor(carol, space)

        await expect(
          alice.client.call(
            com.atproto.space.getLatestCommit,
            { space, repo: alice.did },
            { headers: { authorization: `DPoP ${cred.credential}` } },
          ),
        ).rejects.toThrow(/requires a DPoP proof/)
      })

      it('refuses a credential presented with a key of the holder own', async () => {
        const space = await sc.createSpace(alice, { members: [carol] })
        await sc.write(alice, space, { text: 'not yours to read' })

        const cred = await sc.credentialFor(carol, space)
        const attacker = await JoseKey.generate(['ES256'])
        const rebound = new SpaceCredential(cred.credential, attacker)

        await expect(
          rebound.clientFor(alice.pds).call(com.atproto.space.getLatestCommit, {
            space,
            repo: alice.did,
          }),
        ).rejects.toThrow(/not signed by the key the credential is bound to/)
      })

      it('refuses a proof addressed to another host', async () => {
        const space = await sc.createSpace(alice, { members: [bob, carol] })
        await sc.write(alice, space, { text: 'authority repo' })

        const cred = await sc.credentialFor(carol, space)
        const forBob = await createDpopProof(cred.key, {
          htm: 'GET',
          htu: `${bob.pds.url}/xrpc/${com.atproto.space.getLatestCommit.$lxm}`,
          credential: cred.credential,
        })

        const res = await fetch(
          `${alice.pds.url}/xrpc/${com.atproto.space.getLatestCommit.$lxm}?space=${encodeURIComponent(space)}&repo=${alice.did}`,
          {
            headers: {
              authorization: `DPoP ${cred.credential}`,
              dpop: forBob,
            },
          },
        )
        expect(res.status).toBe(401)
        expect(await res.json()).toMatchObject({
          error: 'BadDpopProof',
          message: expect.stringContaining('does not match the request'),
        })
      })

      it('refuses a replayed proof, but not a second fresh one', async () => {
        // The trailing fresh-proof request is the control: without it the 401 only
        // shows the second request failed, not that the reused `jti` failed it.
        const space = await sc.createSpace(alice, { members: [carol] })
        await sc.write(alice, space, { text: 'replay target' })

        const cred = await sc.credentialFor(carol, space)
        const url = `${alice.pds.url}/xrpc/${com.atproto.space.getLatestCommit.$lxm}?space=${encodeURIComponent(space)}&repo=${alice.did}`
        const requestWith = (proof: string) =>
          fetch(url, {
            headers: {
              authorization: `DPoP ${cred.credential}`,
              dpop: proof,
            },
          })
        const freshProof = () =>
          createDpopProof(cred.key, {
            htm: 'GET',
            htu: url,
            credential: cred.credential,
          })

        const proof = await freshProof()
        expect((await requestWith(proof)).status).toBe(200)

        const replayed = await requestWith(proof)
        expect(replayed.status).toBe(401)
        expect(await replayed.json()).toMatchObject({
          error: 'BadDpopProof',
          message: expect.stringContaining('replayed'),
        })

        expect((await requestWith(await freshProof())).status).toBe(200)
      })

      it('reuses one credential across many hosts, each with its own proof', async () => {
        const space = await sc.createSpace(alice, { members: [bob, carol] })
        await sc.write(alice, space, { text: 'on the authority' })
        await sc.write(bob, space, { text: 'on pds2' })

        const cred = await sc.credentialFor(carol, space)
        for (const host of [alice, bob]) {
          const res = await cred
            .clientFor(host.pds)
            .call(com.atproto.space.listRecords, { space, repo: host.did })
          expect(res.records).toHaveLength(1)
        }
      })
    })

    it('is scoped to one space', async () => {
      const target = await sc.createSpace(alice, {
        skey: 'cred-target',
        members: [carol],
      })
      const other = await sc.createSpace(alice, { skey: 'cred-other' })
      await sc.write(alice, target, { text: 'scoped' })

      const cred = await sc.credentialFor(carol, target)
      const asSyncer = cred.clientFor(alice.pds)
      const ok = await asSyncer.call(com.atproto.space.getLatestCommit, {
        space: target,
        repo: alice.did,
      })
      expect(ok.commit).toBeDefined()

      await expect(
        asSyncer.call(com.atproto.space.listRepoOps, {
          space: other,
          repo: alice.did,
        }),
      ).rejects.toMatchObject({ error: 'InvalidCredential' })
    })

    it('refuses one the space authority did not issue', async () => {
      // Carol self-signs a credential for one of alice's spaces. It verifies
      // against her own signing key, so nothing but the iss/authority check
      // stands between her and the space. Alice writes first, so the read would
      // otherwise succeed — the rejection has to come from auth.
      const space = await sc.createSpace(alice, { members: [carol] })
      await sc.write(alice, space, { text: 'forgery target' })

      // A credential alice did issue reads it fine.
      const valid = await sc.credentialFor(carol, space)
      expect(
        await valid
          .clientFor(alice.pds)
          .call(com.atproto.space.getLatestCommit, {
            space,
            repo: alice.did,
          }),
      ).toBeDefined()

      const carolKeypair = await carol.pds.ctx.actorStore.keypair(carol.did)
      const forged = await sc.forgedCredential((dpopJkt) =>
        createSpaceToken(
          'credential',
          { iss: carol.did, sub: space, dpopJkt },
          carolKeypair,
        ),
      )
      const asForged = forged.clientFor(alice.pds)

      await expect(
        asForged.call(com.atproto.space.getLatestCommit, {
          space,
          repo: alice.did,
        }),
      ).rejects.toThrow(/issuer is not the space authority/)

      // listRepos authorizes off the credential too, on a separate path.
      await expect(
        asForged.call(com.atproto.space.listRepos, { space }),
      ).rejects.toThrow(/issuer is not the space authority/)
    })

    it('refuses one whose kid names a key the authority does not publish', async () => {
      // The authority signs with its #atproto key and says so. A credential
      // claiming #atproto_space must be verified against that key, which alice
      // does not publish — so it cannot pass by falling back to #atproto.
      const space = await sc.createSpace(alice)
      const aliceKeypair = await network.pds.ctx.actorStore.keypair(alice.did)
      const mismatched = await sc.forgedCredential((dpopJkt) =>
        createSpaceToken(
          'credential',
          { iss: alice.did, sub: space, kid: '#atproto_space', dpopJkt },
          aliceKeypair,
        ),
      )

      await expect(
        mismatched
          .clientFor(alice.pds)
          .call(com.atproto.space.getLatestCommit, {
            space,
            repo: alice.did,
          }),
      ).rejects.toThrow(/missing or bad key/)
    })

    it('refuses one for a revoked member', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      // Carol mints a delegation token while she is still a member.
      const token = await sc.delegationTokenFor(carol, space)
      // Alice removes her before she can redeem it.
      await sc.removeMember(alice, space, carol)

      await expect(sc.mintCredential(space, token)).rejects.toMatchObject({
        error: 'UserNotAuthorized',
      })
    })
  })

  describe('delegation tokens', () => {
    it('are useless at a host that does not govern the space', async () => {
      const space = await sc.createSpace(alice, { members: [carol] })
      const token = await sc.delegationTokenFor(carol, space)

      // The same token, presented to bob's PDS instead of alice's. The audience
      // is derived from the token's own `sub`, so it still matches — what stops
      // this is that pds2 hosts no account for alice and so holds no space to
      // mint against. The error names the space rather than leaking that as a
      // missing repo.
      await expect(
        bob.client.call(
          com.atproto.space.getSpaceCredential,
          { space, dpopJkt: 'any-thumbprint' },
          { headers: { authorization: `Bearer ${token}` } },
        ),
      ).rejects.toMatchObject({ error: 'SpaceNotFound' })
    })

    it('are refused when the audience names another authority', async () => {
      // Minted by hand, because getDelegationToken always addresses the space's
      // own authority. Only the aud differs from a token that would be honoured.
      const space = await sc.createSpace(alice, { members: [carol] })
      const carolKeypair = await carol.pds.ctx.actorStore.keypair(carol.did)
      const misaddressed = await createSpaceToken(
        'delegation',
        {
          iss: carol.did,
          sub: space,
          aud: spaceHostAud(bob.did),
        },
        carolKeypair,
      )

      await expect(sc.mintCredential(space, misaddressed)).rejects.toThrow(
        /audience does not match the space authority/,
      )
    })

    // Known gap, tracked rather than silently absent. The spec makes a delegation
    // token single-use, but `jti` is not recorded anywhere, so one can be replayed
    // freely inside its 60s window. Un-skip once minting tracks jti.
    it.todo('are single-use — a replayed jti is refused')

    it('are refused for a space other than their subject', async () => {
      const space = await sc.createSpace(alice, {
        skey: 'deleg-sub',
        members: [carol],
      })
      const other = await sc.createSpace(alice, {
        skey: 'deleg-sub-other',
        members: [carol],
      })
      const token = await sc.delegationTokenFor(carol, space)

      await expect(sc.mintCredential(other, token)).rejects.toMatchObject({
        error: 'InvalidDelegationToken',
      })
    })
  })

  describe('takedowns', () => {
    it('stops serving permissioned records for a taken-down account', async () => {
      // A takedown covers everything the account holds, permissioned data included.
      const space = await sc.createSpace(alice, { members: [dan, carol] })
      await sc.write(dan, space, { text: 'before takedown' })

      const cred = await sc.credentialFor(carol, space)
      const asSyncer = cred.clientFor(alice.pds)
      const readOps = () =>
        asSyncer.call(com.atproto.space.listRepoOps, { space, repo: dan.did })

      expect((await readOps()).ops).toHaveLength(1)

      await network.pds.ctx.accountManager.takedownAccount(dan.did, {
        applied: true,
        ref: 'test-space-takedown',
      })
      try {
        await expect(readOps()).rejects.toMatchObject({
          error: 'RepoTakendown',
        })
      } finally {
        await network.pds.ctx.accountManager.takedownAccount(dan.did, {
          applied: false,
        })
      }

      // Gated, not deleted.
      expect((await readOps()).ops).toHaveLength(1)
    })

    it('stops accepting permissioned writes from a taken-down account', async () => {
      const space = await sc.createSpace(alice, { members: [dan] })
      const write = () => sc.write(dan, space, { text: 'during takedown' })

      await network.pds.ctx.accountManager.takedownAccount(dan.did, {
        applied: true,
        ref: 'test-space-write-takedown',
      })
      try {
        await expect(write()).rejects.toThrow(/taken down/i)
        // Minting a read credential is gated on the same status.
        await expect(
          dan.client.call(
            com.atproto.space.getDelegationToken,
            { space },
            { headers: dan.headers },
          ),
        ).rejects.toThrow(/taken down/i)
      } finally {
        await network.pds.ctx.accountManager.takedownAccount(dan.did, {
          applied: false,
        })
      }

      await expect(write()).resolves.toBeDefined()
    })
  })

  /**
   * OAuth scope enforcement, end to end.
   *
   * `space-scope.test.ts` unit-tests the matcher and `oauth-scopes` tests the
   * grammar; what neither covers is the seam — that a grant issued by the OAuth
   * provider is the grant the PDS then enforces. These drive real handlers with
   * real `ScopePermissions`.
   *
   * The token is stubbed rather than minted through a browser flow (the same
   * approach as `proxied/proxy-oauth-aud.test.ts`): only the credential shape is
   * replaced, so the scope check, the handlers, and storage are all real. The
   * stub's type is pinned to `AuthVerifier['authorization']`, so an OAuth shape
   * change breaks it at compile time.
   */
  describe('OAuth scopes', () => {
    // Set per-call by `asOAuth`, read by the stub installed below.
    let currentScope: string | undefined
    let currentActor: Actor

    beforeAll(() => {
      // `authenticateRequest` is the one piece of the OAuth path called per
      // request — `authorization()` itself runs once, at route registration, so
      // patching it after boot would never be seen. Everything downstream of
      // here is real: the ScopePermissions construction, the scope check in each
      // handler, and storage.
      const verifier = network.pds.ctx.authVerifier.oauthVerifier
      const real = verifier.authenticateRequest.bind(verifier)
      verifier.authenticateRequest = (async (
        method: string,
        url: URL,
        headers: Record<string, unknown>,
        options: unknown,
      ) => {
        if (currentScope === undefined) {
          return real(method, url, headers as never, options as never)
        }
        return { sub: currentActor.did, scope: currentScope }
      }) as typeof verifier.authenticateRequest
    })

    /**
     * Run `fn` as `actor` over a token carrying `scope`.
     *
     * The request has to present a DPoP-scheme authorization header. The verifier
     * dispatches on the scheme, and a `Bearer` header takes the legacy access
     * path, which skips granular scopes entirely — so a test meaning to exercise
     * an OAuth scope has to use DPoP or it silently checks nothing.
     */
    const asOAuth = async <T>(
      actor: Actor,
      scope: string,
      fn: (headers: { authorization: string }) => Promise<T>,
    ): Promise<T> => {
      currentActor = actor
      currentScope = scope
      try {
        return await fn({ authorization: 'DPoP test-oauth-token' })
      } finally {
        currentScope = undefined
      }
    }

    // A grant naming alice's authority explicitly, as one issued for her spaces
    // would after `self` resolution. `atproto` is the base scope every token
    // carries; without it the request is refused before any space check.
    const grant = (params: string) =>
      `atproto space:${TEST_SPACE_TYPE}?authority=${alice.did}&${params}`

    it('enforces the collection a grant names on a write', async () => {
      const space = await sc.createSpace(alice)
      const allowed = SPACE_TYPE_COLLECTIONS[0]
      const forbidden = SPACE_TYPE_COLLECTIONS[1]

      await asOAuth(
        alice,
        grant(`collection=${allowed}&action=create`),
        async (headers) => {
          await expect(
            sc.write(alice, space, {
              collection: allowed,
              rkey: 'ok',
              headers,
            }),
          ).resolves.toBeDefined()

          // Same space, same action, a collection the grant doesn't name.
          await expect(
            sc.write(alice, space, {
              collection: forbidden,
              rkey: 'no',
              headers,
            }),
          ).rejects.toThrow(/space:/)
        },
      )
    })

    it('enforces the action a grant names', async () => {
      const space = await sc.createSpace(alice)
      const collection = SPACE_TYPE_COLLECTIONS[0]
      // Seed a record to delete, outside the restricted grant.
      await sc.write(alice, space, { collection, rkey: 'seeded' })

      await asOAuth(
        alice,
        grant(`collection=${collection}&action=create`),
        async (headers) => {
          await expect(
            sc.del(alice, space, { collection, rkey: 'seeded', headers }),
          ).rejects.toThrow(/space:/)
        },
      )
    })

    it('resolves putRecord to update rather than demanding create too', async () => {
      // putRecord is create-or-update, so it asks for whichever this write is:
      // an app granted only `update` must be able to overwrite, without also
      // needing `create`.
      const space = await sc.createSpace(alice)
      const collection = SPACE_TYPE_COLLECTIONS[0]
      await sc.write(alice, space, { collection, rkey: 'self', text: 'first' })

      await asOAuth(
        alice,
        grant(`collection=${collection}&action=update`),
        async (headers) => {
          await expect(
            sc.put(alice, space, {
              collection,
              rkey: 'self',
              text: 'second',
              headers,
            }),
          ).resolves.toBeDefined()

          // ...but not create one that doesn't exist yet.
          await expect(
            sc.put(alice, space, { collection, rkey: 'fresh', headers }),
          ).rejects.toThrow(/space:/)
        },
      )
    })

    it('refuses a space of a type the grant does not name', async () => {
      const space = await sc.createSpace(alice, {
        type: 'com.example.otherGroup' as NsidString,
      })

      await asOAuth(
        alice,
        grant('collection=*&action=create'),
        async (headers) => {
          await expect(
            sc.write(alice, space, { rkey: 'wrong-type', headers }),
          ).rejects.toThrow(/space:/)
        },
      )
    })

    it('refuses a space under an authority the grant does not name', async () => {
      // A grant naming alice as authority must not reach a space governed by
      // someone else. Dan is co-located with alice on the authority PDS (which is
      // where the stub lives), so this isolates the authority check from any
      // cross-PDS concern.
      const danSpace = await sc.createSpace(dan, { skey: 'dan-governed' })
      await asOAuth(
        dan,
        grant('collection=*&action=create'),
        async (headers) => {
          await expect(
            sc.write(dan, danSpace, { rkey: 'other-authority', headers }),
          ).rejects.toThrow(/space:/)
        },
      )
    })

    it('reads own repo on read_self, and refuses whole-space read', async () => {
      const space = await sc.createSpace(alice)
      await sc.write(alice, space, { rkey: 'mine' })

      await asOAuth(alice, grant('action=read_self'), async (headers) => {
        const own = await alice.client.call(
          com.atproto.space.listRecords,
          { space, repo: alice.did },
          { headers },
        )
        expect(own.records).toHaveLength(1)

        // read_self buys no delegation token: that is the whole-space read grant.
        await expect(
          alice.client.call(
            com.atproto.space.getDelegationToken,
            { space },
            { headers },
          ),
        ).rejects.toThrow(/space:/)
      })
    })

    it('exchanges a whole-space read grant for a delegation token', async () => {
      const space = await sc.createSpace(alice)
      await asOAuth(alice, grant('action=read'), async (headers) => {
        const res = await alice.client.call(
          com.atproto.space.getDelegationToken,
          { space },
          { headers },
        )
        expect(res.token).toBeDefined()
      })
    })

    it('requires a wildcard grant to list spaces unfiltered', async () => {
      // listSpaces has no one space to check against, so the filters are the
      // target: an unfiltered listing is a request to see everything.
      await asOAuth(alice, grant('action=read_self'), async (headers) => {
        await expect(
          alice.client.call(com.atproto.space.listSpaces, {}, { headers }),
        ).rejects.toThrow(/space:/)

        // Narrowed to what the grant covers, it is allowed.
        const listed = await alice.client.call(
          com.atproto.space.listSpaces,
          { type: TEST_SPACE_TYPE, did: alice.did },
          { headers },
        )
        expect(listed.spaces).toBeDefined()
      })
    })

    it('materializes the space type declared collections into a bare grant', async () => {
      // The seam this suite exists for. A bare `space:<type>` names no
      // collections, so on its own it confers no write targets at all; the
      // provider expands it from the space type's lexicon at issuance. This
      // asserts the expansion the provider performs is one the PDS then accepts.
      const scope =
        await network.pds.ctx.oauthProvider!.lexiconManager.buildTokenScope(
          `space:${TEST_SPACE_TYPE}`,
          alice.did,
        )
      // Both declared collections, and `self` resolved to alice.
      for (const collection of SPACE_TYPE_COLLECTIONS) {
        expect(scope).toContain(`collection=${collection}`)
      }
      expect(scope).toContain(`authority=${alice.did}`)

      const space = await sc.createSpace(alice)
      await asOAuth(alice, `atproto ${scope}`, async (headers) => {
        for (const collection of SPACE_TYPE_COLLECTIONS) {
          await expect(
            sc.write(alice, space, {
              collection,
              rkey: `decl-${collection.split('.').pop()}`,
              headers,
            }),
          ).resolves.toBeDefined()
        }
        // A collection the space type never declared stays out of reach.
        await expect(
          sc.write(alice, space, {
            collection: TEST_COLLECTION,
            rkey: 'undeclared',
            headers,
          }),
        ).rejects.toThrow(/space:/)
      })
    })
  })
})
