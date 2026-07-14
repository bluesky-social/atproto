import { once } from 'node:events'
import type * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import { default as express } from 'express'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Tap } from '../src/client.js'

describe('Tap client', () => {
  describe('constructor', () => {
    it('accepts http URL', () => {
      const tap = new Tap('http://localhost:8080')
      expect(tap.url).toBe('http://localhost:8080')
    })

    it('accepts https URL', () => {
      const tap = new Tap('https://example.com')
      expect(tap.url).toBe('https://example.com')
    })

    it('throws on invalid URL', () => {
      expect(() => new Tap('ws://localhost:8080')).toThrow(
        'Invalid URL, expected http:// or https://',
      )
      expect(() => new Tap('localhost:8080')).toThrow(
        'Invalid URL, expected http:// or https://',
      )
    })
  })

  describe('HTTP methods', () => {
    let terminator: httpTerminator.HttpTerminator
    let tap: Tap
    let requests: {
      path: string
      method: string
      body?: unknown
      headers: http.IncomingHttpHeaders
    }[]

    beforeAll(async () => {
      const app = express()
      app.use(express.json())

      requests = []

      app.post('/repos/add', (req, res) => {
        requests.push({
          path: req.path,
          method: req.method,
          body: req.body,
          headers: req.headers,
        })
        res.sendStatus(200)
      })

      app.post('/repos/remove', (req, res) => {
        requests.push({
          path: req.path,
          method: req.method,
          body: req.body,
          headers: req.headers,
        })
        res.sendStatus(200)
      })

      app.get('/resolve/:did', (req, res) => {
        requests.push({
          path: req.path,
          method: req.method,
          headers: req.headers,
        })
        if (req.params.did === 'did:example:notfound') {
          res.sendStatus(404)
          return
        }
        res.json({
          id: req.params.did,
          alsoKnownAs: ['at://alice.test'],
          verificationMethod: [],
          service: [],
        })
      })

      app.get('/info/:did', (req, res) => {
        requests.push({
          path: req.path,
          method: req.method,
          headers: req.headers,
        })
        res.json({
          did: req.params.did,
          handle: 'alice.test',
          state: 'active',
          rev: '3abc123',
          records: 42,
        })
      })

      const server = app.listen()
      await once(server, 'listening')
      const { port } = server.address() as AddressInfo
      terminator = httpTerminator.createHttpTerminator({ server })
      tap = new Tap(`http://localhost:${port}`, { adminPassword: 'secret' })
    })

    afterAll(async () => {
      await terminator?.terminate()
    })

    beforeEach(() => {
      requests = []
    })

    describe('addRepos', () => {
      it('sends POST to /repos/add with dids', async () => {
        await tap.addRepos(['did:example:alice', 'did:example:bob'])
        expect(requests).toHaveLength(1)
        expect(requests[0].path).toBe('/repos/add')
        expect(requests[0].method).toBe('POST')
        expect(requests[0].body).toEqual({
          dids: ['did:example:alice', 'did:example:bob'],
        })
      })

      it('includes auth header', async () => {
        await tap.addRepos(['did:example:alice'])
        expect(requests[0].headers.authorization).toBe('Basic YWRtaW46c2VjcmV0')
      })
    })

    describe('removeRepos', () => {
      it('sends POST to /repos/remove with dids', async () => {
        await tap.removeRepos(['did:example:alice'])
        expect(requests).toHaveLength(1)
        expect(requests[0].path).toBe('/repos/remove')
        expect(requests[0].method).toBe('POST')
        expect(requests[0].body).toEqual({ dids: ['did:example:alice'] })
      })
    })

    describe('resolveDid', () => {
      it('fetches and parses DID document', async () => {
        const doc = await tap.resolveDid('did:example:alice')
        expect(doc).not.toBeNull()
        expect(doc?.id).toBe('did:example:alice')
        expect(doc?.alsoKnownAs).toEqual(['at://alice.test'])
      })

      it('returns null for 404', async () => {
        const doc = await tap.resolveDid('did:example:notfound')
        expect(doc).toBeNull()
      })
    })

    describe('getRepoInfo', () => {
      it('fetches and parses repo info', async () => {
        const info = await tap.getRepoInfo('did:example:alice')
        expect(info.did).toBe('did:example:alice')
        expect(info.handle).toBe('alice.test')
        expect(info.state).toBe('active')
        expect(info.records).toBe(42)
      })
    })
  })

  describe('HTTP error handling', () => {
    let terminator: httpTerminator.HttpTerminator
    let tap: Tap

    beforeAll(async () => {
      const app = express()
      app.use(express.json())

      app.post('/repos/add', (_req, res) => {
        res.status(500).send('Internal Server Error')
      })

      app.get('/info/:did', (_req, res) => {
        res.status(500).send('Internal Server Error')
      })

      const server = app.listen(0)
      await once(server, 'listening')
      const { port } = server.address() as AddressInfo
      terminator = httpTerminator.createHttpTerminator({ server })
      tap = new Tap(`http://localhost:${port}`)
    })

    afterAll(async () => {
      await terminator?.terminate()
    })

    it('throws on addRepos failure', async () => {
      await expect(tap.addRepos(['did:example:alice'])).rejects.toThrow(
        'Failed to add repos',
      )
    })

    it('throws on getRepoInfo failure', async () => {
      await expect(tap.getRepoInfo('did:example:alice')).rejects.toThrow(
        'Failed to get repo info',
      )
    })
  })
})
