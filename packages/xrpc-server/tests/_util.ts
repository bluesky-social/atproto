import * as http from 'http'
import express from 'express'
import * as xrpc from '../src/index'

export async function createServer(
  port: number,
  server: xrpc.Server,
  parse?: { json?: boolean; raw?: boolean; text?: boolean },
): Promise<http.Server> {
  const app = express()
  if (parse?.json !== false) app.use(express.json())
  if (parse?.raw !== false) app.use(express.raw())
  if (parse?.text !== false) app.use(express.text())
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
