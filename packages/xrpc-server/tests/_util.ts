import * as http from 'node:http'
import { once } from 'node:events'
import express from 'express'
import * as xrpc from '../src'
import { AuthRequiredError } from '../src'

export async function createServer({
  router,
}: xrpc.Server): Promise<http.Server> {
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
