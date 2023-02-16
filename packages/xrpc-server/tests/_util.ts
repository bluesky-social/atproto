import * as http from 'http'
import express from 'express'
import * as xrpc from '../src'
import { AuthRequiredError } from '../src'

export async function createServer(
  port: number,
  server: xrpc.Server,
): Promise<http.Server> {
  const app = express()
  app.use(server.router)
  const httpServer = app.listen(port)
  await new Promise((r) => httpServer.on('listening', r))
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
