import { once } from 'node:events'
import * as http from 'node:http'
import express from 'express'
import {
  LexiconDocument,
  LexiconIterableIndexer,
  LexiconSchemaBuilder,
} from '@atproto/lex-document'
import { LexiconDoc } from '@atproto/lexicon'
import {
  AuthRequiredError,
  MethodConfigOrHandler,
  Options,
  Server,
  StreamConfigOrHandler,
} from '../src'

export async function createServer({ router }: Server): Promise<http.Server> {
  const app = express()
  app.use(router)
  const httpServer = app.listen(0)
  await once(httpServer, 'listening')
  return httpServer
}

export async function closeServer(httpServer: http.Server) {
  await new Promise((r) => {
    httpServer.close(() => r(undefined))
  })
}

export function createBasicAuth(allowed: {
  username: string
  password: string
}) {
  return function (ctx: { req: http.IncomingMessage }) {
    const header = ctx.req.headers.authorization ?? ''
    if (!header.startsWith('Basic ')) {
      throw new AuthRequiredError()
    }
    const original = header.replace('Basic ', '')
    const [username, password] = Buffer.from(original, 'base64')
      .toString()
      .split(':')
    if (username !== allowed.username || password !== allowed.password) {
      throw new AuthRequiredError()
    }
    return {
      credentials: { username },
      artifacts: { original },
    }
  }
}

export function basicAuthHeaders(creds: {
  username: string
  password: string
}) {
  return {
    authorization:
      'Basic ' +
      Buffer.from(`${creds.username}:${creds.password}`).toString('base64'),
  }
}

export async function buildMethodLexicons(
  lexicons: LexiconDoc[],
  handlers: Record<string, MethodConfigOrHandler | StreamConfigOrHandler>,
  options?: Options,
) {
  const server = new Server(structuredClone(lexicons), options)
  for (const [id, handler] of Object.entries(handlers)) {
    const def = server.lex.getDef(id)
    if (def?.type === 'subscription') {
      server.addStreamMethod(id, handler as StreamConfigOrHandler)
    } else {
      server.method(id, handler as MethodConfigOrHandler)
    }
  }
  return server
}

export async function buildAddLexicons(
  lexicons: LexiconDocument[],
  handlers: Record<string, MethodConfigOrHandler | StreamConfigOrHandler>,
  options?: Options,
) {
  const server = new Server(undefined, options)
  const indexer = new LexiconIterableIndexer(structuredClone(lexicons))
  const builder = new LexiconSchemaBuilder(indexer)
  for (const [id, handler] of Object.entries(handlers)) {
    const schema = await builder.buildFullRef(`${id}#main`)
    server.add(schema as any, handler as any)
  }
  await builder.done()
  return server
}
