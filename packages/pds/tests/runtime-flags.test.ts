import { runTestServer, TestServerInfo } from './_util'

describe('runtime_flags', () => {
  let server: TestServerInfo

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'runtime_flags',
    })
  })

  afterAll(async () => {
    await server.close()
  })

  it('updates flags with refresh.', async () => {
    await server.ctx.db.db
      .insertInto('runtime_flag')
      .values({ name: 'appview-proxy:a.b.c.d', value: '4' })
      .execute()
    await server.ctx.runtimeFlags.refresh()
    expect(server.ctx.runtimeFlags.get('appview-proxy:a.b.c.d')).toEqual('4')

    await server.ctx.db.db
      .deleteFrom('runtime_flag')
      .where('name', '=', 'appview-proxy:a.b.c.d')
      .execute()
    await server.ctx.runtimeFlags.refresh()
    expect(server.ctx.runtimeFlags.get('appview-proxy:a.b.c.d')).toEqual(null)
  })

  it('gets appview-proxy flag default.', async () => {
    expect(
      server.ctx.runtimeFlags.appviewProxy.getThreshold('a.b.c.d'),
    ).toEqual(0)
  })

  it('gets appview-proxy flag when set.', async () => {
    await server.ctx.db.db
      .insertInto('runtime_flag')
      .values([
        { name: 'appview-proxy:a.b.c.d', value: '0' },
        { name: 'appview-proxy:a.b.c.e', value: '4' },
        { name: 'appview-proxy:a.b.c.f', value: '10' },
      ])
      .execute()
    await server.ctx.runtimeFlags.refresh()
    expect(
      server.ctx.runtimeFlags.appviewProxy.getThreshold('a.b.c.d'),
    ).toEqual(0)
    expect(
      server.ctx.runtimeFlags.appviewProxy.getThreshold('a.b.c.e'),
    ).toEqual(4)
    expect(
      server.ctx.runtimeFlags.appviewProxy.getThreshold('a.b.c.f'),
    ).toEqual(10)
  })

  it('gets appview-proxy flag as default when set to invalid value.', async () => {
    await server.ctx.db.db
      .insertInto('runtime_flag')
      .values([
        { name: 'appview-proxy:a.b.c.bad1', value: '-1' },
        { name: 'appview-proxy:a.b.c.bad2', value: '' },
        { name: 'appview-proxy:a.b.c.bad3', value: '11' },
      ])
      .execute()
    await server.ctx.runtimeFlags.refresh()
    expect(
      server.ctx.runtimeFlags.appviewProxy.getThreshold('a.b.c.bad1'),
    ).toEqual(0)
    expect(
      server.ctx.runtimeFlags.appviewProxy.getThreshold('a.b.c.bad2'),
    ).toEqual(0)
    expect(
      server.ctx.runtimeFlags.appviewProxy.getThreshold('a.b.c.bad3'),
    ).toEqual(0)
  })

  it('appview should-proxy partitions consistently by did.', async () => {
    const dids = [
      'did:plc:3',
      'did:plc:9',
      'did:plc:6',
      'did:plc:1',
      'did:plc:16',
      'did:plc:12',
      'did:plc:25',
      'did:plc:20',
      'did:plc:0',
      'did:plc:4',
    ]

    await server.ctx.db.db
      .insertInto('runtime_flag')
      .values({ name: 'appview-proxy:a.b.c.g', value: '' })
      .execute()

    const shouldProxy = (did) =>
      server.ctx.runtimeFlags.appviewProxy.shouldProxy('a.b.c.g', did)

    const updateFlag = (value: string) =>
      server.ctx.db.db
        .updateTable('runtime_flag')
        .set({ value })
        .where('name', '=', 'appview-proxy:a.b.c.g')
        .execute()

    await updateFlag('0')
    await server.ctx.runtimeFlags.refresh()
    await expect(Promise.all(dids.map(shouldProxy))).resolves.toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ])

    await updateFlag('4')
    await server.ctx.runtimeFlags.refresh()
    await expect(Promise.all(dids.map(shouldProxy))).resolves.toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ])

    await updateFlag('7')
    await server.ctx.runtimeFlags.refresh()
    await expect(Promise.all(dids.map(shouldProxy))).resolves.toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ])

    await updateFlag('10')
    await server.ctx.runtimeFlags.refresh()
    await expect(Promise.all(dids.map(shouldProxy))).resolves.toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ])

    expect(server.ctx.runtimeFlags.appviewProxy.partitionCache.size).toEqual(10)
  })
})
