import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { Cursor, GenericKeyset, paginate } from '../../../../db/pagination'
import { formatAccountStatus } from '../../../../account-manager'
import { html, toArrayBuffer } from '../../../../util/html'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.listRepos(async ({ params, req }) => {
    const { limit, cursor } = params
    const db = ctx.accountManager.db
    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('actor')
      .innerJoin('repo_root', 'repo_root.did', 'actor.did')
      .select([
        'actor.did as did',
        'repo_root.cid as head',
        'repo_root.rev as rev',
        'actor.createdAt as createdAt',
        'actor.deactivatedAt as deactivatedAt',
        'actor.takedownRef as takedownRef',
      ])
    const keyset = new TimeDidKeyset(ref('actor.createdAt'), ref('actor.did'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
      direction: 'asc',
      tryIndex: true,
    })
    const res = await builder.execute()
    const repos = res.map((row) => {
      const { active, status } = formatAccountStatus(row)
      return {
        did: row.did,
        head: row.head,
        rev: row.rev ?? '',
        active,
        status,
      }
    })

    if (req.accepts(['json', 'html']) === 'html') {
      return {
        encoding: 'text/html',
        buffer: page({
          repos,
          cursor: keyset.packFromResult(res),
          publicUrl: ctx.cfg.service.publicUrl,
        }),
      }
    }

    return {
      encoding: 'application/json',
      body: {
        cursor: keyset.packFromResult(res),
        repos,
      },
    }
  })
}

type TimeDidResult = { createdAt: string; did: string }

export class TimeDidKeyset extends GenericKeyset<TimeDidResult, Cursor> {
  labelResult(result: TimeDidResult): Cursor {
    return { primary: result.createdAt, secondary: result.did }
  }
  labeledResultToCursor(labeled: Cursor) {
    return {
      primary: new Date(labeled.primary).getTime().toString(),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: Cursor) {
    const primaryDate = new Date(parseInt(cursor.primary, 10))
    if (isNaN(primaryDate.getTime())) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: primaryDate.toISOString(),
      secondary: cursor.secondary,
    }
  }
}

function page({
  repos,
  cursor,
  publicUrl,
}: {
  repos: {
    did: string
    head: string
    rev: string
    active: boolean
    status: string | undefined
  }[]
  cursor: string | undefined
  publicUrl: string | undefined
}) {
  return toArrayBuffer(`<!DOCTYPE html>
  <html>
    <head>
      <title>Repositories</title>
    </head>
    <body style="font-family:monospace;">
      <h1>Repositories</h1>
      <table style="width:100%;text-align:left;">
        <tr>
          <th>DID</th>
          <th>Commit</th>
          <th>Revision</th>
          <th>Active</th>
          <th>Status</th>
        </tr>
        ${html(
          repos.map(({ did, head, rev, active, status }) => {
            return `<tr>
              <td>
                <a href="/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}">
                  ${html(did)}
                </a>
              </td>
              <td>${html(head)}</td>
              <td>${html(rev)}</td>
              <td>${active ? '✔' : ''}</td>
              <td>${html(status)}</td>
            </tr>`
          }),
        )}
        ${
          repos.length === 0
            ? `<tr>
              <td colspan="5">
                <span style="font-style:italic;color:grey;">(none)</span>
              </td>
            </td>`
            : ''
        }
      </table>
      ${
        cursor
          ? `<p>
              <a href="/xrpc/com.atproto.sync.listRepos?cursor=${encodeURIComponent(cursor)}">Next ${html('>')}</a>
            </p>`
          : `<p>
              <a href="/xrpc/com.atproto.sync.listRepos">${html('<')} First</a>
            </p>`
      }
      <p style="padding-top:20px;font-style:italic;color:grey;">AT Protocol PDS running at ${html(publicUrl)}</p>
    </body>
  </html>`)
}
