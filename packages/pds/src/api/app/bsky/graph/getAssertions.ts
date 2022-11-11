import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as GetAssertions from '../../../../lexicon/types/app/bsky/graph/getAssertions'
import { getActorInfo } from '../util'
import * as locals from '../../../../locals'
import { paginate } from '../../../../db/util'

export default function (server: Server) {
  server.app.bsky.graph.getAssertions(
    async (params: GetAssertions.QueryParams, _input, _req, res) => {
      const { actor, assertion, confirmed, limit, before } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      const subject = await getActorInfo(db.db, actor).catch((_e) => {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      })

      let assertionsReq = db.db
        .selectFrom('assertion')
        .where('assertion.creator', '=', subject.did)
        .if(typeof assertion === 'string', (q) =>
          q.where('assertion.assertion', '=', assertion as string),
        )
        .if(confirmed === true, (q) =>
          q.where('assertion.confirmUri', 'is not', null),
        )
        .if(confirmed === false, (q) =>
          q.where('assertion.confirmUri', 'is', null),
        )
        .innerJoin(
          'did_handle as subject',
          'subject.did',
          'assertion.subjectDid',
        )
        .leftJoin('profile', 'profile.creator', 'subject.did')
        .select([
          'assertion.uri as uri',
          'assertion.cid as cid',
          'assertion.assertion as assertionType',
          'assertion.confirmUri',
          'assertion.confirmCid',
          'assertion.confirmCreated',
          'assertion.confirmIndexed',
          'subject.did as subjectDid',
          'subject.handle as subjectHandle',
          'subject.declarationCid as subjectDeclarationCid',
          'subject.actorType as subjectActorType',
          'profile.displayName as subjectDisplayName',
          'assertion.createdAt as createdAt',
          'assertion.indexedAt as indexedAt',
        ])

      assertionsReq = paginate(assertionsReq, {
        limit,
        before,
        by: ref('assertion.createdAt'),
      })

      const assertionsRes = await assertionsReq.execute()
      const assertions = assertionsRes.map((row) => ({
        uri: row.uri,
        cid: row.cid,
        assertion: row.assertionType,
        confirmation: row.confirmUri
          ? {
              uri: row.confirmUri,
              cid: row.confirmCid,
              indexedAt: row.confirmIndexed,
              createdAt: row.confirmCreated,
            }
          : undefined,
        subject: {
          did: row.subjectDid,
          handle: row.subjectHandle,
          declaration: {
            cid: row.subjectDeclarationCid,
            actorType: row.subjectActorType,
          },
          displayName: row.subjectDisplayName || undefined,
        },
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject,
          assertions,
          cursor: assertions.at(-1)?.createdAt,
        },
      }
    },
  )
}
