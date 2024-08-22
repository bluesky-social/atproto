import { InvalidRequestError } from '@atproto/xrpc-server'
import * as id from '@atproto/identity'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { INVALID_HANDLE } from '@atproto/syntax'
import { assertRepoAvailability } from '../sync/util'
import { html, toArrayBuffer } from '../../../../util/html'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.describeRepo(async ({ params, req }) => {
    const { repo } = params

    const account = await assertRepoAvailability(ctx, repo, false)

    let didDoc
    try {
      didDoc = await ctx.idResolver.did.ensureResolve(account.did)
    } catch (err) {
      throw new InvalidRequestError(`Could not resolve DID: ${err}`)
    }

    const handle = id.getHandle(didDoc)
    const handleIsCorrect = handle === account.handle

    const collections = await ctx.actorStore.read(account.did, (store) =>
      store.record.listCollections(),
    )

    if (req.accepts(['json', 'html']) === 'html') {
      return {
        encoding: 'text/html',
        buffer: page({ did: account.did, handle: account.handle, collections }),
      }
    }

    return {
      encoding: 'application/json',
      body: {
        handle: account.handle ?? INVALID_HANDLE,
        did: account.did,
        didDoc,
        collections,
        handleIsCorrect,
      },
    }
  })
}

function page({
  did,
  handle,
  collections,
}: {
  did: string
  handle: string | null
  collections: string[]
}) {
  return toArrayBuffer(`<!DOCTYPE html>
  <html>
    <head>
      <title>Repo at://${html(handle ?? did)}</title>
    </head>
    <body style="font-family:monospace">
      <h1>Repo at://${html(handle ?? did)}</h1>
      <table>
        <tr>
          <th>DID</th>
          <td>${html(did)}</td>
        </tr>
        <tr>
          <th>Collections</th>
          <td>
            <ul>
              ${html(
                collections.map((collection) => {
                  return `<li>
                    <a href="/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}">
                      ${html(collection)}
                    </a>
                  </li>`
                }),
              )}
            </ul>
          </td>
        </tr>
      </table>
    </body>
  </html>`)
}
