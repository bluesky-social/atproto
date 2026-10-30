import { Timestamp } from '@bufbuild/protobuf'
import { Code, ConnectError } from '@connectrpc/connect'
import { Router } from 'express'
import type { AppContext } from '../context.js'
import { httpLogger as log } from '../logger.js'
import { SitemapPageType } from '../proto/bsky_pb.js'

export const createRouter = (ctx: AppContext): Router => {
  const router = Router()

  router.get('/external/sitemap/users.xml.gz', async (_req, res, next) => {
    try {
      const result = await ctx.dataplane.getSitemapIndex({
        type: SitemapPageType.USER,
      })
      res.set('Content-Type', 'application/gzip')
      res.set('Content-Encoding', 'gzip')
      res.end(result.sitemap)
    } catch (err) {
      log.error({ err }, 'failed to get sitemap index')
      next(err)
    }
  })

  router.get(
    '/external/sitemap/users/:date/:bucket.xml.gz',
    async (req, res, next) => {
      const { date, bucket } = req.params

      // Parse date (YYYY-MM-DD format)
      const dateParts = date.split('-')
      if (dateParts.length !== 3) {
        return res.status(400).send('Invalid date format. Expected YYYY-MM-DD')
      }

      const year = parseInt(dateParts[0], 10)
      const month = parseInt(dateParts[1], 10)
      const day = parseInt(dateParts[2], 10)

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return res.status(400).send('Invalid date format. Expected YYYY-MM-DD')
      }

      // Parse bucket (1-indexed)
      const bucketNum = parseInt(bucket, 10)
      if (isNaN(bucketNum) || bucketNum < 1) {
        return res.status(400).send('Invalid bucket number')
      }

      try {
        const result = await ctx.dataplane.getSitemapPage({
          type: SitemapPageType.USER,
          date: Timestamp.fromDate(new Date(year, month - 1, day)),
          bucket: bucketNum,
        })
        res.set('Content-Type', 'application/gzip')
        res.set('Content-Encoding', 'gzip')
        res.end(result.sitemap)
      } catch (err) {
        if (err instanceof ConnectError && err.code === Code.NotFound) {
          return res.status(404).send('Sitemap page not found')
        }
        log.error({ err }, 'failed to get sitemap page')
        next(err)
      }
    },
  )

  return router
}
