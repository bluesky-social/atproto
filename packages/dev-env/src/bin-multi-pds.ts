import './env'
import { TestNetworkNoAppView } from './network-no-appview'
import { TestPds } from './pds'
import { mockMailer } from './util'

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

  // Seed one account per PDS so each has data that's reachable cross-PDS.
  const seeded: { handle: string; did: string; pds: string }[] = []
  for (const { label, pds, domain } of allPdses) {
    const agent = pds.getAgent()
    const handle = `alice.${domain}`
    const res = await agent.com.atproto.server.createAccount({
      handle,
      email: `alice-${domain}@test.com`,
      password: 'alice-pass',
    })
    seeded.push({ handle, did: res.data.did, pds: label })
  }

  console.log('\n👥 Seeded accounts:')
  for (const acct of seeded) {
    console.log(
      `  ${acct.pds.padEnd(16)} handle=${acct.handle.padEnd(20)} did=${acct.did}`,
    )
  }
  console.log('  (password for all: alice-pass)')
}

run()
