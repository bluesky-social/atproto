import { IncomingMessage, ServerResponse } from 'node:http'
import AppContext from '../context'
import { isValidDid } from '../routes/util'
import { Database } from '..'
import { sql } from 'kysely'
import { createSubsOpChannel } from '../db/schema/subs_op'

export const isRevenueCatWebhookUrl = (urlStr: string | undefined) => {
  if (!urlStr) return false
  const url = new URL(urlStr, 'http://host')
  return url.pathname === '/webhooks/revenuecat'
}

const parseBody = async (req: IncomingMessage) =>
  new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })

// Reference: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields#events-format
type RevenueCatEventBody = {
  api_version: '1.0'
  event: {
    app_user_id: string
    type: string
  }
}

export const revenueCatWebhookHandler = async (
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
) => {
  const { db, revenueCatClient } = ctx

  res.setHeader('content-type', 'application/json')

  if (!revenueCatClient) {
    res.statusCode = 501
    return res.end(
      JSON.stringify({
        error:
          'Not Implemented: bsync is being served without RevenueCat support',
      }),
    )
  }

  if (
    !revenueCatClient.isWebhookAuthorizationValid(req.headers['authorization'])
  ) {
    res.statusCode = 403
    return res.end(
      JSON.stringify({
        error: 'Forbidden: invalid authentication for RevenueCat webhook',
      }),
    )
  }

  if (req.method !== 'POST') {
    res.statusCode = 501
    return res.end(
      JSON.stringify({
        error:
          'Not Implemented: only POST method is supported for RevenueCat webhook',
      }),
    )
  }

  if (req.headers['content-type'] !== 'application/json') {
    res.statusCode = 400
    return res.end(
      JSON.stringify({
        error:
          'Bad request: body must be JSON with Content-Type: application/json',
      }),
    )
  }

  let body: RevenueCatEventBody
  try {
    body = (await parseBody(req)) as RevenueCatEventBody
  } catch (error) {
    res.statusCode = 400
    return res.end(
      JSON.stringify({
        error: 'Bad request: malformed JSON body',
      }),
    )
  }

  try {
    const { app_user_id: actorDid } = body.event

    if (!isValidDid(actorDid)) {
      res.statusCode = 400
      return res.end(
        JSON.stringify({
          error: 'Bad request: invalid DID in app_user_id',
        }),
      )
    }

    const entitlements =
      await revenueCatClient.getEntitlementIdentifiers(actorDid)

    const id = await db.transaction(async (txn) => {
      // create subs op
      const id = await createSubsOp(txn, actorDid, entitlements)
      // update subs state
      await updateSubsItem(txn, id, actorDid, entitlements)
      return id
    })

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, operationId: id }))
  } catch (error) {
    res.statusCode = 500
    return res.end(
      JSON.stringify({
        error:
          'Internal server error: an error happened while processing the request',
      }),
    )
  }
}

const createSubsOp = async (
  db: Database,
  actorDid: string,
  entitlements: string[],
) => {
  const { ref } = db.db.dynamic
  const { id } = await db.db
    .insertInto('subs_op')
    .values({
      actorDid,
      entitlements: JSON.stringify(entitlements),
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await sql`notify ${ref(createSubsOpChannel)}`.execute(db.db) // emitted transactionally
  return id
}

const updateSubsItem = async (
  db: Database,
  fromId: number,
  actorDid: string,
  entitlements: string[],
) => {
  const { ref } = db.db.dynamic
  await db.db
    .insertInto('subs_item')
    .values({
      actorDid,
      entitlements: JSON.stringify(entitlements),
      fromId,
    })
    .onConflict((oc) =>
      oc.column('actorDid').doUpdateSet({
        entitlements: sql`${ref('excluded.entitlements')}`,
        fromId: sql`${ref('excluded.fromId')}`,
      }),
    )
    .execute()
}
