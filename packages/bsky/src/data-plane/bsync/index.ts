import assert from 'node:assert'
import events from 'node:events'
import http from 'node:http'
import { ConnectRouter } from '@connectrpc/connect'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import express from 'express'
import * as crypto from '@atproto/crypto'
import { AtUri } from '@atproto/syntax'
import { ids } from '../../lexicon/lexicons'
import { Service } from '../../proto/bsync_connect'
import { Method, MuteOperation_Type } from '../../proto/bsync_pb'
import { Database } from '../server/db'

export class MockBsync {
  constructor(public server: http.Server) {}

  static async create(db: Database, port: number) {
    const app = express()
    const routes = createRoutes(db)
    app.use(expressConnectMiddleware({ routes }))
    const server = app.listen(port)
    await events.once(server, 'listening')
    return new MockBsync(server)
  }

  async destroy() {
    return new Promise<void>((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
}

const createRoutes = (db: Database) => (router: ConnectRouter) =>
  router.service(Service, {
    async addMuteOperation(req) {
      const { type, actorDid, subject } = req
      if (type === MuteOperation_Type.ADD) {
        if (subject.startsWith('did:')) {
          assert(actorDid !== subject, 'cannot mute yourself') // @TODO pass message through in http error
          await db.db
            .insertInto('mute')
            .values({
              mutedByDid: actorDid,
              subjectDid: subject,
              createdAt: new Date().toISOString(),
            })
            .onConflict((oc) => oc.doNothing())
            .execute()
        } else {
          const uri = new AtUri(subject)
          if (uri.collection === ids.AppBskyGraphList) {
            await db.db
              .insertInto('list_mute')
              .values({
                mutedByDid: actorDid,
                listUri: subject,
                createdAt: new Date().toISOString(),
              })
              .onConflict((oc) => oc.doNothing())
              .execute()
          } else {
            await db.db
              .insertInto('thread_mute')
              .values({
                mutedByDid: actorDid,
                rootUri: subject,
                createdAt: new Date().toISOString(),
              })
              .onConflict((oc) => oc.doNothing())
              .execute()
          }
        }
      } else if (type === MuteOperation_Type.REMOVE) {
        if (subject.startsWith('did:')) {
          await db.db
            .deleteFrom('mute')
            .where('mutedByDid', '=', actorDid)
            .where('subjectDid', '=', subject)
            .execute()
        } else {
          const uri = new AtUri(subject)
          if (uri.collection === ids.AppBskyGraphList) {
            await db.db
              .deleteFrom('list_mute')
              .where('mutedByDid', '=', actorDid)
              .where('listUri', '=', subject)
              .execute()
          } else {
            await db.db
              .deleteFrom('thread_mute')
              .where('mutedByDid', '=', actorDid)
              .where('rootUri', '=', subject)
              .execute()
          }
        }
      } else if (type === MuteOperation_Type.CLEAR) {
        await db.db
          .deleteFrom('mute')
          .where('mutedByDid', '=', actorDid)
          .execute()
        await db.db
          .deleteFrom('list_mute')
          .where('mutedByDid', '=', actorDid)
          .execute()
      }

      return {}
    },

    async scanMuteOperations() {
      throw new Error('not implemented')
    },

    async addNotifOperation(req) {
      const { actorDid, priority } = req
      if (priority !== undefined) {
        await db.db
          .insertInto('actor_state')
          .values({
            did: actorDid,
            priorityNotifs: priority,
            lastSeenNotifs: new Date().toISOString(),
          })
          .onConflict((oc) =>
            oc.column('did').doUpdateSet({ priorityNotifs: priority }),
          )
          .execute()
      }
      return {}
    },

    async scanNotifOperations() {
      throw new Error('not implemented')
    },

    async putOperation(req) {
      const { actorDid, collection, rkey, method, payload: payloadBuffer } = req
      const payload = Buffer.from(payloadBuffer).toString('utf8')
      const uri = `at://${actorDid}/${collection}/${rkey}`

      if (method === Method.CREATE) {
        await db.db
          .insertInto('private_record')
          .values({
            uri,
            actorDid,
            collection,
            rkey,
            payload,
            indexedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .execute()
      } else if (method === Method.UPDATE) {
        await db.db
          .updateTable('private_record')
          .where('uri', '=', uri)
          .set({
            payload,
            updatedAt: new Date().toISOString(),
          })
          .execute()
      } else if (method === Method.DELETE) {
        await db.db
          .deleteFrom('private_record')
          .where('uri', '=', uri)
          .execute()
      } else {
        throw new Error(`Unsupported method: ${method}`)
      }

      // @NOTE: This operation ID is opaque to the client, and is used as a cursor to scan.
      // Since we don't implement scanning for dev-env, it can be any value.
      const operationId = crypto.randomStr(16, 'hex')

      return {
        operation: {
          id: operationId,
          actorDid,
          collection,
          rkey,
          method,
          uri,
          payload: payloadBuffer,
        },
      }
    },

    async scanOperations() {
      throw new Error('not implemented')
    },

    async ping() {
      return {}
    },
  })
