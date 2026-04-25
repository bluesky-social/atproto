// Import env first to respect LOG_ENABLED
import '../src/env'
import fs from 'node:fs/promises'
import { TestNetworkNoAppView } from '@atproto/dev-env'

function intEnv(name: string, fallback: number): number {
  const v = process.env[name]
  if (v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function nonEmptyEnv(name: string): string | undefined {
  const v = process.env[name]
  return v && v.length > 0 ? v : undefined
}

async function main() {
  const plcPort = intEnv('PLC_PORT', 3001)
  const pdsPort = intEnv('PDS_PORT', 3000)
  const pdsHostname = process.env.PDS_HOSTNAME ?? 'localhost'
  // In single-container Docker, PDS reaches PLC on loopback (not localhost on some OS).
  const didPlcUrl = process.env.PDS_DID_PLC_URL ?? `http://127.0.0.1:${plcPort}`

  const pdsPublicUrl =
    nonEmptyEnv('PDS_PUBLIC_URL') ??
    (pdsHostname === 'localhost'
      ? `http://localhost:${pdsPort}`
      : `https://${pdsHostname}`)

  const plcHostname = nonEmptyEnv('PLC_HOSTNAME')
  const plcPublicUrl =
    nonEmptyEnv('PLC_PUBLIC_URL') ??
    (plcHostname ? `https://${plcHostname}` : `http://localhost:${plcPort}`)

  console.log('🚀 Starting PDS + PLC servers...\n')

  // Ensure persistent storage directories exist before starting servers
  if (process.env.PDS_DATA_DIRECTORY) {
    await fs.mkdir(process.env.PDS_DATA_DIRECTORY, { recursive: true })
  }
  if (process.env.PDS_BLOB_STORE_LOCATION) {
    await fs.mkdir(process.env.PDS_BLOB_STORE_LOCATION, { recursive: true })
  }

  // Create PDS + PLC network (no appview)
  const network = await TestNetworkNoAppView.create({
    plc: {
      port: plcPort,
      ...(process.env.PLC_DB_URL ? { dbUrl: process.env.PLC_DB_URL } : {}),
    },
    pds: {
      port: pdsPort,
      hostname: pdsHostname,
      didPlcUrl,
      inviteRequired: false, // No invite code needed
      ...(process.env.PDS_DATA_DIRECTORY
        ? { dataDirectory: process.env.PDS_DATA_DIRECTORY }
        : {}),
      ...(process.env.PDS_BLOB_STORE_LOCATION
        ? { blobstoreDiskLocation: process.env.PDS_BLOB_STORE_LOCATION }
        : {}),
    },
  })

  console.log('✅ Servers running!')
  console.log(`📡 PLC (internal): ${network.plc.url}`)
  console.log(`📡 PLC (clients):  ${plcPublicUrl}`)
  console.log(
    `💾 PLC storage:    ${
      process.env.PLC_DB_URL
        ? 'Postgres (' +
          process.env.PLC_DB_URL.replace(/:\/\/[^@]+@/, '://***@') +
          ')'
        : 'in-memory mock (ephemeral)'
    }`,
  )
  console.log(`📡 PDS (internal): ${network.pds.url}`)
  console.log(`📡 PDS (clients):  ${pdsPublicUrl}`)
  console.log(`📡 PDS DID: ${network.pds.ctx.cfg.service.did}\n`)
  console.log(
    `💾 PDS storage:    ${process.env.PDS_DATA_DIRECTORY ?? 'tmpdir (ephemeral)'}`,
  )
  console.log(
    `💾 PDS blobs:      ${process.env.PDS_BLOB_STORE_LOCATION ?? 'tmpdir (ephemeral)'}`,
  )
  console.log('💡 Point Sokaa / AtpAgent service URL at:', pdsPublicUrl)
  console.log('💡 Press Ctrl+C to stop\n')

  // Keep running until interrupted
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down servers...')
    await network.close()
    console.log('✅ Servers stopped')
    process.exit(0)
  })

  // Keep the process alive
  await new Promise(() => {}) // Never resolves, keeps process running
}

main().catch((error) => {
  console.error('❌ Error starting servers:', error)
  process.exit(1)
})
