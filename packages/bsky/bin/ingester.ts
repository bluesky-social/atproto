#!/usr/bin/env ts-node

import assert from 'node:assert'
import { wait } from '@atproto/common'
import { Redis } from '../src/redis'
import {
  BackfillIngester,
  FirehoseIngester,
} from '../src/data-plane/server/ingester'

export async function main() {
  const host = process.env.INGESTER_HOST
  const redisHost = process.env.REDIS_HOST
  assert(
    host,
    'must set INGESTER_HOST, e.g. https://morel.us-east.host.bsky.network',
  )
  assert(redisHost, 'must set REDIS_HOST, e.g. redis://localhost:6380')
  const redis = new Redis({ host: redisHost })
  const firehose = new FirehoseIngester({
    redis,
    host,
    stream: 'firehose',
    highWaterMark: 100,
  })
  const backfill = new BackfillIngester({
    redis,
    host,
    stream: 'backfill',
    highWaterMark: 10000,
  })
  firehose.run()
  backfill.run()
  await wait(60000)
  await firehose.stop()
  await backfill.stop()
  await redis.destroy()
}

main()
