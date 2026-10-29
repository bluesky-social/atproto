import { type VerifiedRecord, readRepoStar } from '@atproto/space'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { throwInvalidArchive } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.importRepo, {
    opts: {
      blobLimit: ctx.cfg.service.maxImportSize,
    },
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      scopes: ACCESS_FULL,
      authorize: (permissions) => {
        permissions.assertAccount({ attr: 'repo', action: 'manage' })
      },
    }),
    handler: async ({ input, auth }) => {
      if (!ctx.cfg.service.acceptingImports) {
        throw new InvalidRequestError('Service is not accepting repo imports')
      }

      const { did } = auth.credentials

      // @NOTE read the whole archive before the transaction, as
      // com.atproto.repo.importRepo does with its CAR.
      const { commit, records } = await readRepo(input.body).catch(
        throwInvalidArchive,
      )
      if (commit.repo !== did) {
        throw new InvalidRequestError(
          'Repo does not match the authenticated account',
        )
      }

      await ctx.actorStore.transact(did, (actorTxn) =>
        actorTxn.space.importRepo(commit.space, records),
      )
    },
  })
}

async function readRepo(body: AsyncIterable<Uint8Array>) {
  await using repo = await readRepoStar(body)
  const records: VerifiedRecord[] = []
  for await (const record of repo.records) {
    records.push(record)
  }
  return { commit: repo.commit, records }
}
