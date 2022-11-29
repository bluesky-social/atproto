import * as http from 'http'
import express from 'express'
import * as xrpc from '../src/index'

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
