import './env'
import { IntrospectServer } from './introspect'
import { TestNetworkNoAppView } from './network-no-appview'
import { TestPds } from './pds'
import { mockMailer } from './util'

const INTROSPECT_PORT = 2581

const parsePdsCount = (): number => {
  const arg = process.argv[2]
  if (arg === undefined) return 3
  const n = Number.parseInt(arg, 10)
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid PDS count "${arg}": must be an integer >= 1`)
  }
  return n
}

const run = async () => {
  const totalPdsCount = parsePdsCount()
  const extraPdsCount = totalPdsCount - 1

  console.log(`
██████╗
██╔═══██╗
██║██╗██║
██║██║██║
╚█║████╔╝
 ╚╝╚═══╝  protocol

[ created by Bluesky ]`)

  const network = await TestNetworkNoAppView.create({
    pds: {
      port: 2583,
      hostname: 'localhost',
      enableDidDocWithSession: true,
    },
    plc: { port: 2582 },
    extraPdses: extraPdsCount,
  })
  mockMailer(network.pds)
  for (const extra of network.extraPdses) {
    mockMailer(extra)
  }

  const introspect = await IntrospectServer.start(INTROSPECT_PORT, network.plc, [
    network.pds,
    ...network.extraPdses,
  ])

  console.log(`🔍 Introspection server http://localhost:${introspect.port}`)
  console.log(`👤 DID Placeholder server http://localhost:${network.plc.port}`)

  const allPdses: { label: string; pds: TestPds; domain: string }[] = [
    { label: 'pds1 (primary)', pds: network.pds, domain: 'test' },
    ...network.extraPdses.map((pds, i) => ({
      label: `pds${i + 2}`,
      pds,
      domain: `test${i + 2}`,
    })),
  ]

  for (const { label, pds } of allPdses) {
    console.log(`🌞 ${label} http://localhost:${pds.port}`)
  }

  // Seed alice/bob/carol on each PDS so each has data that's reachable cross-PDS.
  const seedNames = ['alice', 'bob', 'carol']
  const seeded: { handle: string; did: string; pds: string }[] = []
  for (const { label, pds, domain } of allPdses) {
    const agent = pds.getAgent()
    for (const name of seedNames) {
      const handle = `${name}.${domain}`
      const res = await agent.com.atproto.server.createAccount({
        handle,
        email: `${name}-${domain}@test.com`,
        password: `${name}-pass`,
      })
      seeded.push({ handle, did: res.data.did, pds: label })
    }
  }

  console.log('\n👥 Seeded accounts:')
  for (const acct of seeded) {
    console.log(
      `  ${acct.pds.padEnd(16)} handle=${acct.handle.padEnd(20)} did=${acct.did}`,
    )
  }
  console.log('  (passwords: alice-pass / bob-pass / carol-pass)')
}

run()
