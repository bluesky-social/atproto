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
            value: record.value,
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
  value,
}: {
  did: string
  handle: string | null
  collection: string
  rkey: string
  value: unknown
}) {
  const uri = AtUri.make(handle ?? did, collection, rkey).toString()
  const uriWithDid = AtUri.make(did, collection, rkey).toString()
  return toArrayBuffer(`<!DOCTYPE html>
  <html>
    <head>
      <title>Record ${html(uri)}</title>
    </head>
    <body style="font-family:monospace">
      <h1>Record ${html(uri)}</h1>
      <p><i>${html(uriWithDid)}</i></p>
      <pre>${html(JSON.stringify(value, null, 2))}</pre>
      <script>
        const pre = document.querySelector('pre')
        pre.innerHTML = pre.textContent.replace(/"(at:\\/\\/did:.+?)"/g, (_, match) => {
          const a = document.createElement('a')
          a.href = \`/at?uri=\${encodeURIComponent(match)}\`
          a.textContent = match
          return \`"\${a.outerHTML}"\`
        })
      </script>
    </body>
  </html>`)
}
