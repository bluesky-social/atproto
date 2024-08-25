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
        buffer: page({
          did: account.did,
          handle: account.handle,
          collections,
          publicUrl: ctx.cfg.service.publicUrl,
        }),
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
  publicUrl,
}: {
  did: string
  handle: string | null
  collections: string[]
  publicUrl: string
}) {
  return toArrayBuffer(`<!DOCTYPE html>
  <html>
    <head>
      <title>Repository at://${html(handle ?? did)}</title>
    </head>
    <body style="font-family:monospace;">
      <h1>Repository at://${html(handle ?? did)}</h1>
      <p style="font-style:italic;color:grey;">
        Go to <a href="/xrpc/com.atproto.sync.listRepos">Repositories</a>
      </p>
      <table style="text-align:left;">
        <tr><th>DID</th></tr>
        <tr><td>${html(did)}</td></tr>
        <tr><td>&nbsp;</td></tr>
        <tr><th>Collections</th></tr>
        ${html(
          collections.map((collection) => {
            return `<tr>
              <td>
                <a href="/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}">
                  ${html(collection)}
                </a>
              </td>
            </tr>`
          }),
        )}
        ${
          collections.length === 0
            ? `<tr>
              <td>
                <span style="font-style:italic;color:grey;">(none)</span>
              </td>
            </td>`
            : ''
        }
        </tr>
      </table>
      <p style="padding-top:20px;font-style:italic;color:grey;">AT Protocol PDS running at ${html(publicUrl)}</p>
    </body>
  </html>`)
}
