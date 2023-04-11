import fs from 'fs/promises'
import AtpAgent, { AppBskyActorProfile, AppBskyFeedPost } from '@atproto/api'
import { AtUri } from '@atproto/uri'
import { CloseFn, forSnapshot, runTestServer, TestServerInfo } from './_util'
import { SeedClient } from './seeds/client'
import usersSeed from './seeds/users'
import { AppContext, Database } from '../src'
import { prepareCreate, prepareDelete, prepareUpdate } from '../src/repo'
import { ids } from '../src/lexicon/lexicons'
import * as hive from '../src/labeler/hive'
import { wait } from '@atproto/common'

describe('labeling', () => {
  let ctx: AppContext
  let close: CloseFn
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'labeling',
      labelerKeywords: {
        porn: 'porn',
        gore: 'gore',
        spam: 'spam',
      },
    })
    ctx = server.ctx
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await usersSeed(sc)
  })

  afterAll(async () => {
    await close()
  })

  it('correclty parses hive responses', async () => {
    const exampleRespBytes = await fs.readFile(
      'tests/fixtures/hiveai_resp_example.json',
    )
    const exmapleResp = JSON.parse(exampleRespBytes.toString())
    const classes = hive.respToClasses(exmapleResp)
    expect(classes.length).toBeGreaterThan(10)

    const labels = hive.summarizeLabels(classes)
    expect(labels).toEqual(['porn'])
  })

  it('creates labels for posts', async () => {
    await sc.post(sc.dids.alice, 'hello porn gore')
    await ctx.labeler.processAll()
    // await wait(500)
    const got = await ctx.db.db.selectFrom('label').selectAll().execute()
    console.log(got)
  })
})
