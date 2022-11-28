import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as GetAssertions from '../../../../lexicon/types/app/bsky/graph/getAssertions'
import { getActorInfo } from '../util'
import * as locals from '../../../../locals'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'

export default function (server: Server) {
  server.app.bsky.graph.getAssertions(
    async (params: GetAssertions.QueryParams, _input, _req, res) => {
      const { author, subject, assertion, confirmed, limit, before } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      if (!author && !subject) {
        throw new InvalidRequestError(`Must provide an author or subject`)
      }

      const authorInfo =
        author &&
        (await getActorInfo(db.db, author).catch((_e) => {
          throw new InvalidRequestError(`Actor not found: ${author}`)
        }))
      const subjectInfo =
        subject &&
        (await getActorInfo(db.db, subject).catch((_e) => {
          throw new InvalidRequestError(`Actor not found: ${subject}`)
        }))

      let assertionsReq = db.db
        .selectFrom('assertion')
        .if(typeof assertion === 'string', (q) =>
          q.where('assertion.assertion', '=', assertion as string),
        )
        .if(confirmed === true, (q) =>
          q.where('assertion.confirmUri', 'is not', null),
        )
        .if(confirmed === false, (q) =>
          q.where('assertion.confirmUri', 'is', null),
        )
        .innerJoin('did_handle as author', 'author.did', 'assertion.creator')
        .leftJoin(
          'profile as authorProfile',
          'authorProfile.creator',
          'author.did',
        )
        .innerJoin(
          'did_handle as subject',
          'subject.did',
          'assertion.subjectDid',
        )
        .leftJoin(
          'profile as subjectProfile',
          'subjectProfile.creator',
          'subject.did',
        )
        .select([
          'assertion.uri as uri',
          'assertion.cid as cid',
          'assertion.assertion as assertionType',
          'assertion.confirmUri',
          'assertion.confirmCid',
          'assertion.confirmCreated',
          'assertion.confirmIndexed',
          'author.did as authorDid',
          'author.handle as authorHandle',
          'author.declarationCid as authorDeclarationCid',
          'author.actorType as authorActorType',
          'authorProfile.displayName as authorDisplayName',
          'subject.did as subjectDid',
          'subject.handle as subjectHandle',
          'subject.declarationCid as subjectDeclarationCid',
          'subject.actorType as subjectActorType',
          'subjectProfile.displayName as subjectDisplayName',
          'assertion.createdAt as createdAt',
          'assertion.indexedAt as indexedAt',
        ])

      if (authorInfo) {
        assertionsReq = assertionsReq.where(
          'assertion.creator',
          '=',
          authorInfo.did,
        )
      }

      if (subjectInfo) {
        assertionsReq = assertionsReq.where(
          'assertion.subjectDid',
          '=',
          subjectInfo.did,
        )
      }

      const keyset = new TimeCidKeyset(
        ref('assertion.createdAt'),
        ref('assertion.cid'),
      )
      assertionsReq = paginate(assertionsReq, {
        limit,
        before,
        keyset,
      })

      const assertionsRes = await assertionsReq.execute()
      const assertions = assertionsRes.map((row) => ({
        uri: row.uri,
        cid: row.cid,
        assertion: row.assertionType,
        confirmation:
          row.confirmUri &&
          row.confirmCid &&
          row.confirmIndexed &&
          row.confirmCreated
            ? {
                uri: row.confirmUri,
                cid: row.confirmCid,
                indexedAt: row.confirmIndexed,
                createdAt: row.confirmCreated,
              }
            : undefined,
        author: {
          did: row.authorDid,
          handle: row.authorHandle,
          declaration: {
            cid: row.authorDeclarationCid,
            actorType: row.authorActorType,
          },
          displayName: row.authorDisplayName || undefined,
        },
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
          assertions,
          cursor: keyset.packFromResult(assertionsRes),
        },
      }
    },
  )
}
