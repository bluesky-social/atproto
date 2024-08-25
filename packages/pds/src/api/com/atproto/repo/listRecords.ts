import assert from 'node:assert'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { html, toArrayBuffer } from '../../../../util/html'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.listRecords(async ({ params, req }) => {
    const {
      repo,
      collection,
      limit = 50,
      cursor,
      rkeyStart,
      rkeyEnd,
      reverse = false,
    } = params

    const did = await ctx.accountManager.getDidForActor(repo)
    if (!did) {
      throw new InvalidRequestError(`Could not find repo: ${repo}`)
    }

    const records = await ctx.actorStore.read(did, (store) =>
      store.record.listRecordsForCollection({
        collection,
        limit,
        reverse,
        cursor,
        rkeyStart,
        rkeyEnd,
      }),
    )

    const lastRecord = records.at(-1)
    const lastUri = lastRecord && new AtUri(lastRecord?.uri)

    if (req.accepts(['json', 'html']) === 'html') {
      const account = await ctx.accountManager.getAccount(did)
      assert(account, 'account could not be fetched')
      return {
        encoding: 'text/html',
        buffer: page({
          did: account.did,
          handle: account.handle,
          collection,
          records,
          cursor: lastUri?.rkey,
          publicUrl: ctx.cfg.service.publicUrl,
        }),
      }
    }

    return {
      encoding: 'application/json',
      body: {
        records,
        // Paginate with `before` by default, paginate with `after` when using `reverse`.
        cursor: lastUri?.rkey,
      },
    }
  })
}

function page({
  did,
  handle,
  collection,
  records,
  cursor,
  publicUrl,
}: {
  did: string
  handle: string | null
  collection: string
  records: { uri: string; cid: string; size: number }[]
  cursor: string | undefined
  publicUrl: string
}) {
  const collectionUri = AtUri.make(handle ?? did, collection).toString()
  return toArrayBuffer(`<!DOCTYPE html>
  <html>
    <head>
      <title>Collection ${html(collectionUri)}</title>
    </head>
    <body style="font-family:monospace;">
      <h1>Collection ${html(collectionUri)}</h1>
      <p style="font-style:italic;color:grey;">
        Go to at://<a href="/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}">${html(did)}</a>
      </p>
      <table style="text-align:left;width:100%;">
        <tr>
          <th>Record Key</th>
          <th>CID</th>
          <th>Size (bytes)</th>
        </tr>
        ${html(
          records.map(({ uri, cid, size }) => {
            const rkey = new AtUri(uri).rkey
            return `<tr>
              <td>
                <a href="/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}">
                  ${html(rkey)}
                </a>
              </td>
              <td>${html(cid)}</td>
              <td>${html(size.toLocaleString())}</td>
            </tr>`
          }),
        )}
        ${
          records.length === 0
            ? `<tr>
              <td colspan="3">
                <span style="font-style:italic;color:grey;">(none)</span>
              </td>
            </td>`
            : ''
        }
      </table>
      ${
        cursor
          ? `<p>
              <a href="/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}&cursor=${encodeURIComponent(cursor)}">Next ${html('>')}</a>
            </p>`
          : `<p>
              <a href="/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}">First</a>
            </p>`
      }
    <p style="padding-top:20px;font-style:italic;color:grey;">AT Protocol PDS running at ${html(publicUrl)}</p>
    </body>
  </html>`)
}
