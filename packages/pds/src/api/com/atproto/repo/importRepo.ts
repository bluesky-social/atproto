import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { readCarWithRoot, MemoryBlockstore, Repo } from '@atproto/repo'
import * as ui8 from 'uint8arrays'
import SqlRepoStorage from '../../../../sql-repo-storage'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { prepareCreate, PreparedCreate } from '../../../../repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.importRepo({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      let carBytes = new Uint8Array([])
      for await (const chunk of input.body) {
        carBytes = ui8.concat([carBytes, new Uint8Array(chunk)])
      }
      const car = await readCarWithRoot(carBytes)
      const storage = new MemoryBlockstore(car.blocks)
      const repo = await Repo.load(storage, car.root)
      const contents = await repo.getContents()

      const creates: PreparedCreate[] = []
      for (const collection of Object.keys(contents)) {
        for (const rkey of Object.keys(contents[collection])) {
          creates.push(
            await prepareCreate({
              did: requester,
              collection,
              rkey,
              record: contents[collection][rkey],
            }),
          )
        }
      }

      const head = await ctx.db.transaction(async (dbTxn) => {
        const repoSrvc = ctx.services.repo(dbTxn)
        const storage = new SqlRepoStorage(ctx.db, requester)
        const prevHead = await storage.getHead()
        if (prevHead !== null) {
          throw new InvalidRequestError(
            `Repo already exists for user: ${requester}`,
          )
        }
        return await repoSrvc.createRepo(
          requester,
          creates,
          new Date().toISOString(),
        )
      })

      return {
        encoding: 'application/json',
        body: {
          head: head.toString(),
        },
      }
    },
  })
}
