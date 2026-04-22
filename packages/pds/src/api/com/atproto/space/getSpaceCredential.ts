import { getVerificationMaterial } from '@atproto/common'
import { getDidKeyFromMultibase, IdResolver } from '@atproto/identity'
import {
  createSpaceCredential,
  verifyMemberGrant,
} from '@atproto/space'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getSpaceCredential, {
    handler: async ({ input }) => {
      const { space, grant, serviceEndpoint } = input.body

      // Parse the grant to get the member DID (iss)
      const parts = grant.split('.')
      if (parts.length !== 3) {
        throw new InvalidRequestError('Invalid grant format', 'InvalidGrant')
      }
      let grantPayload: { iss?: string }
      try {
        grantPayload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString(),
        )
      } catch {
        throw new InvalidRequestError('Invalid grant format', 'InvalidGrant')
      }
      const memberDid = grantPayload.iss
      if (!memberDid) {
        throw new InvalidRequestError(
          'Missing issuer in grant',
          'InvalidGrant',
        )
      }

      // Resolve member's DID doc to get signing key
      const memberDidDoc = await ctx.idResolver.did.resolve(memberDid)
      if (!memberDidDoc) {
        throw new InvalidRequestError(
          'Could not resolve member DID',
          'InvalidGrant',
        )
      }
      const parsedKey = getVerificationMaterial(memberDidDoc, 'atproto')
      if (!parsedKey) {
        throw new InvalidRequestError(
          'Missing key in member DID doc',
          'InvalidGrant',
        )
      }
      const didKey = getDidKeyFromMultibase(parsedKey)
      if (!didKey) {
        throw new InvalidRequestError(
          'Bad key in member DID doc',
          'InvalidGrant',
        )
      }

      // Verify the grant JWT
      let verified
      try {
        verified = await verifyMemberGrant(grant, didKey)
      } catch (err) {
        throw new InvalidRequestError(
          `Invalid grant: ${err instanceof Error ? err.message : String(err)}`,
          'InvalidGrant',
        )
      }

      // Verify grant.aud matches space owner
      const spaceUri = new SpaceUri(space)
      const ownerDid = spaceUri.spaceDid
      if (verified.aud !== ownerDid) {
        throw new InvalidRequestError(
          'Grant audience does not match space owner',
          'InvalidGrant',
        )
      }

      // Verify grant.space matches requested space
      if (verified.space !== space) {
        throw new InvalidRequestError(
          'Grant space does not match requested space',
          'InvalidGrant',
        )
      }

      // Check membership via owner's actor store
      const isMember = await ctx.actorStore.read(ownerDid, (store) =>
        store.space.isMember(space, memberDid),
      )
      if (!isMember) {
        throw new InvalidRequestError(
          'Member not found in space',
          'NotAMember',
        )
      }

      // Issue space credential
      const keypair = await ctx.actorStore.keypair(ownerDid)
      const credential = await createSpaceCredential(
        {
          iss: ownerDid,
          space,
          clientId: verified.clientId,
        },
        keypair,
      )

      // Record credential recipient if serviceEndpoint provided
      if (serviceEndpoint) {
        await ctx.actorStore.transact(ownerDid, async (actorTxn) => {
          await actorTxn.space.recordCredentialRecipient(
            space,
            memberDid,
            serviceEndpoint,
          )
        })
      }

      return {
        encoding: 'application/json' as const,
        body: { credential },
      }
    },
  })
}
