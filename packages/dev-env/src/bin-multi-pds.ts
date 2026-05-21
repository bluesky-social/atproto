import './env.js'
import getPort from 'get-port'
import { IntrospectServer } from './introspect.js'
import { TestPds } from './pds.js'
import { TestPlc } from './plc.js'
import { LexiconAuthorityProfile } from './service-profile-lexicon.js'
import { mockMailer, mockNetworkUtilities } from './util.js'

const INTROSPECT_PORT = 2581
const PRIMARY_PDS_PORT = 2583
const PLC_PORT = 2582

// The lex-authority account hosts permission-set / space lexicon docs that
// dev-env PDSes resolve via `lexiconDidAuthority`. Demo apps can log into this
// account to publish new lexicons (e.g. `space`-typed documents) at runtime.
const LEX_AUTHORITY_USER = {
  email: 'lex-authority@test.com',
  handle: 'lex-authority.test',
  password: 'hunter2',
}

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

  const plc = await TestPlc.create({ port: PLC_PORT })

  // Step 1 — scratch PDS. We need an existing PDS to host the lex-authority
  // account creation, but we don't want the scratch to live past startup. The
  // account migrates to the primary PDS once we know its DID.
  const scratchPds = await TestPds.create({
    didPlcUrl: plc.url,
    inviteRequired: false,
    port: await getPort(),
  })

  // Step 2 — create the lex-authority account on the scratch PDS so we can
  // capture its DID before any "real" PDS spins up with `lexiconDidAuthority`
  // pointing at it.
  const lexAuthority = await LexiconAuthorityProfile.create(
    scratchPds,
    LEX_AUTHORITY_USER,
  )
  const lexAuthorityDid = lexAuthority.did

  // Step 3 — primary PDS, configured to resolve lexicons from the authority.
  const primary = await TestPds.create({
    port: PRIMARY_PDS_PORT,
    hostname: 'localhost',
    enableDidDocWithSession: true,
    didPlcUrl: plc.url,
    lexiconDidAuthority: lexAuthorityDid,
  })

  // Step 4 — migrate the authority account to the primary PDS, then publish
  // the seed lexicon docs (permission sets, etc.) at the new home.
  await lexAuthority.migrateTo(primary)
  await lexAuthority.createRecords()

  // Step 5 — extra PDSes, each pointing at the same lex authority.
  const extraPdses: TestPds[] = []
  for (let i = 0; i < extraPdsCount; i++) {
    const domain = `.test${i + 2}`
    const extra = await TestPds.create({
      didPlcUrl: plc.url,
      port: await getPort(),
      serviceHandleDomains: [domain],
      lexiconDidAuthority: lexAuthorityDid,
    })
    extraPdses.push(extra)
  }

  // Step 6 — close the scratch PDS now that the authority lives on primary.
  await scratchPds.close()

  // Mock network utilities (handle/DID resolution) across the surviving PDSes.
  const allPdsesArray = [primary, ...extraPdses]
  mockNetworkUtilities(allPdsesArray)
  for (const pds of allPdsesArray) {
    mockMailer(pds)
  }

  const introspect = await IntrospectServer.start(
    INTROSPECT_PORT,
    plc,
    allPdsesArray,
    undefined,
    undefined,
    {
      did: lexAuthorityDid,
      handle: LEX_AUTHORITY_USER.handle,
      password: LEX_AUTHORITY_USER.password,
      pds: primary.url,
    },
  )

  console.log(`🔍 Introspection server http://localhost:${introspect.port}`)
  console.log(`👤 DID Placeholder server ${plc.url}`)

  const allPdses: { label: string; pds: TestPds; domain: string }[] = [
    { label: 'pds1 (primary)', pds: primary, domain: 'test' },
    ...extraPdses.map((pds, i) => ({
      label: `pds${i + 2}`,
      pds,
      domain: `test${i + 2}`,
    })),
  ]

  for (const { label, pds } of allPdses) {
    console.log(`🌞 ${label} http://localhost:${pds.port}`)
  }

  console.log(
    `\n📚 Lex authority ${LEX_AUTHORITY_USER.handle} (${lexAuthorityDid})`,
  )
  console.log(
    `   hosted on pds1 — log in with password "${LEX_AUTHORITY_USER.password}"`,
  )

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
