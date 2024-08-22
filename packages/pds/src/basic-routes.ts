import assert from 'node:assert'
import express from 'express'
import { sql } from 'kysely'
import AppContext from './context'
import { AtUri, ensureValidDid } from '@atproto/syntax'

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  router.get('/', function (req, res) {
    res.type('text/plain')
    res.send(
      'This is an AT Protocol Personal Data Server (PDS): https://github.com/bluesky-social/atproto\n\nMost API routes are under /xrpc/',
    )
  })

  router.get('/robots.txt', function (req, res) {
    res.type('text/plain')
    res.send(
      '# Hello!\n\n# Crawling the public API is allowed\nUser-agent: *\nAllow: /',
    )
  })

  router.get('/xrpc/_health', async function (req, res) {
    const { version } = ctx.cfg.service
    try {
      await sql`select 1`.execute(ctx.accountManager.db.db)
    } catch (err) {
      req.log.error(err, 'failed health check')
      res.status(503).send({ version, error: 'Service Unavailable' })
      return
    }
    res.send({ version })
  })

  router.get('/at', async function (req, res) {
    const uri = req.query.uri
    let aturi: AtUri
    try {
      assert(typeof uri === 'string')
      aturi = new AtUri(uri)
      ensureValidDid(aturi.host)
    } catch {
      return res.status(400).send({
        error: 'InvalidRequest',
        message:
          'The uri query parameter must be an AT URI for a record, containing a DID.',
      })
    }
    let redirectUrl: URL
    try {
      const data = await ctx.idResolver.did.resolveAtprotoData(aturi.host)
      if (aturi.rkey) {
        redirectUrl = new URL('/xrpc/com.atproto.repo.getRecord', data.pds)
        redirectUrl.searchParams.set('repo', aturi.host)
        redirectUrl.searchParams.set('collection', aturi.collection)
        redirectUrl.searchParams.set('rkey', aturi.rkey)
      } else if (aturi.collection) {
        redirectUrl = new URL('/xrpc/com.atproto.repo.listRecords', data.pds)
        redirectUrl.searchParams.set('repo', aturi.host)
        redirectUrl.searchParams.set('collection', aturi.collection)
      } else {
        redirectUrl = new URL('/xrpc/com.atproto.repo.describeRepo', data.pds)
        redirectUrl.searchParams.set('repo', aturi.host)
      }
    } catch {
      return res.status(404).send({
        error: 'NotFound',
        message: 'Could not resolve the DID.',
      })
    }
    return res.redirect(redirectUrl.toString())
  })

  return router
}
