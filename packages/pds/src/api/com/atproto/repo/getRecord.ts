import assert from 'node:assert'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { pipethrough } from '../../../../pipethrough'
import { html, toArrayBuffer } from '../../../../util/html'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord(async ({ req, params }) => {
    const { repo, collection, rkey, cid } = params
    const did = await ctx.accountManager.getDidForActor(repo)

    // fetch from pds if available, if not then fetch from appview
    if (did) {
      const uri = AtUri.make(did, collection, rkey)
      const record = await ctx.actorStore.read(did, (store) =>
        store.record.getRecord(uri, cid ?? null),
      )
      if (!record || record.takedownRef !== null) {
        throw new InvalidRequestError(`Could not locate record: ${uri}`)
      }

      if (req.accepts(['json', 'html']) === 'html') {
        const account = await ctx.accountManager.getAccount(did)
        assert(account, 'account could not be fetched')
        return {
          encoding: 'text/html',
          buffer: page({
            did: account.did,
            handle: account.handle,
            collection,
            rkey,
            cid: record.cid,
            size: record.size,
            value: record.value,
            publicUrl: ctx.cfg.service.publicUrl,
          }),
        }
      }

      return {
        encoding: 'application/json',
        body: {
          uri: uri.toString(),
          cid: record.cid,
          value: record.value,
        },
      }
    }

    if (!ctx.cfg.bskyAppView) {
      throw new InvalidRequestError(`Could not locate record`)
    }

    return await pipethrough(ctx, req, null)
  })
}

function page({
  did,
  handle,
  collection,
  rkey,
  cid,
  size,
  value,
  publicUrl,
}: {
  did: string
  handle: string | null
  collection: string
  rkey: string
  cid: string
  size: number
  value: unknown
  publicUrl: string
}) {
  const uri = AtUri.make(handle ?? did, collection, rkey).toString()
  return toArrayBuffer(`<!DOCTYPE html>
  <html>
    <head>
      <title>Record ${html(uri)}</title>
    </head>
    <body style="font-family:monospace;">
      <h1>Record ${html(uri)}</h1>
      <p style="font-style:italic;color:grey;">
        Go to at://<a href="/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}">${html(did)}</a>/<a href="/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}">${html(collection)}</a>
      </p>
      <table style="text-align:left;min-width:600px;">
        <tr>
          <th>CID</th>
          <th>Size (bytes)</th>
        </tr>
        <tr>
          <td>${html(cid)}</td>
          <td>${html(size)}</td>
        </tr>
      </table>
      <pre id="record_value">${html(JSON.stringify(typeFieldFirst(value), null, 2))}</pre>
      <p style="padding-top:20px;font-style:italic;color:grey;">AT Protocol PDS running at ${html(publicUrl)}</p>
      <script>
        const el = document.getElementById('record_value')
        el.innerHTML = el.textContent.replace(/"(?:(at:\\/\\/did:.+?)|(did:.+?))"/g, (_, uri, did) => {
          const a = document.createElement('a')
          if (uri) {
            a.href = \`/at?uri=\${encodeURIComponent(uri)}\`
            a.textContent = uri
          } else if (did) {
            a.href = \`/at?uri=\${encodeURIComponent(\`at://\${did}\`)}\`
            a.textContent = did
          }
          return \`"\${a.outerHTML}"\`
        })
      </script>
    </body>
  </html>`)
}

function typeFieldFirst(obj: unknown) {
  if (!obj || typeof obj !== 'object') return obj
  const result = {}
  if ('$type' in obj) {
    result['$type'] = obj.$type
  }
  for (const [key, val] of Object.entries(obj)) {
    result[key] = val
  }
  return result
}
