// Import env first to respect LOG_ENABLED
import '../src/env'
import fs from 'node:fs/promises'
import { TestNetworkNoAppView, TestNetworkSokaa } from '@atproto/dev-env'
import { type ServerEnvironment, readEnv } from '@atproto/pds'

/** Merge `readEnv()` into TestPds options; omit undefined so dev-env defaults still apply. */
function pdsEnvFromProcess(): Partial<ServerEnvironment> {
  const raw = readEnv()

  // If S3/R2 is configured, exclude disk blobstore settings to avoid conflicts.
  // readEnv() maps PDS_BLOBSTORE_DISK_LOCATION → blobstoreDiskLocation; if that
  // var exists alongside PDS_BLOBSTORE_S3_BUCKET, envToCfg would throw.
  if (raw.blobstoreS3Bucket) {
    delete raw.blobstoreDiskLocation
    delete raw.blobstoreDiskTmpLocation
  }

  const out = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  ) as Partial<ServerEnvironment>
  if (
    out.serviceHandleDomains &&
    Array.isArray(out.serviceHandleDomains) &&
    out.serviceHandleDomains.length === 0
  ) {
    delete out.serviceHandleDomains
  }
  return out
}

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

  const appviewEnabled =
    process.env.APPVIEW_ENABLED === 'true' ||
    process.env.APPVIEW_ENABLED === '1'
  const dbPostgresUrl = nonEmptyEnv('DB_POSTGRES_URL')

  if (appviewEnabled && !dbPostgresUrl) {
    throw new Error(
      'APPVIEW_ENABLED requires DB_POSTGRES_URL for Sokaa AppView Postgres',
    )
  }

  // Ensure persistent storage directories exist before starting servers
  if (process.env.PDS_DATA_DIRECTORY) {
    await fs.mkdir(process.env.PDS_DATA_DIRECTORY, { recursive: true })
  }
  if (process.env.PDS_BLOB_STORE_LOCATION) {
    await fs.mkdir(process.env.PDS_BLOB_STORE_LOCATION, { recursive: true })
  }

  const pdsConfig = {
    ...pdsEnvFromProcess(),
    port: pdsPort,
    hostname: pdsHostname,
    didPlcUrl,
    ...(process.env.PDS_DATA_DIRECTORY
      ? { dataDirectory: process.env.PDS_DATA_DIRECTORY }
      : {}),
    ...(process.env.PDS_BLOBSTORE_S3_BUCKET
      ? { blobstoreDiskLocation: undefined }
      : process.env.PDS_BLOB_STORE_LOCATION
        ? { blobstoreDiskLocation: process.env.PDS_BLOB_STORE_LOCATION }
        : {}),
  }

  const network = appviewEnabled
    ? await TestNetworkSokaa.create({
        plc: {
          port: plcPort,
          ...(process.env.PLC_DB_URL ? { dbUrl: process.env.PLC_DB_URL } : {}),
        },
        pds: pdsConfig,
        dbPostgresUrl,
        dbPostgresSchema: process.env.DB_POSTGRES_SCHEMA ?? 'pds_plc',
      })
    : await TestNetworkNoAppView.create({
        plc: {
          port: plcPort,
          ...(process.env.PLC_DB_URL ? { dbUrl: process.env.PLC_DB_URL } : {}),
        },
        pds: pdsConfig,
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
  if ('sokaa' in network) {
    console.log(`📡 Sokaa AppView: ${network.sokaa.url}`)
    console.log(`📡 Sokaa AppView DID: ${network.sokaa.serverDid}\n`)
  }
  console.log(
    `🔧 PDS devMode=${network.pds.ctx.cfg.service.devMode} invites.required=${network.pds.ctx.cfg.invites.required}`,
  )
  console.log(
    `💾 PDS storage:    ${process.env.PDS_DATA_DIRECTORY ?? 'tmpdir (ephemeral)'}`,
  )
  console.log(
    `💾 PDS blobs:      ${
      process.env.PDS_BLOBSTORE_S3_BUCKET
        ? `S3/R2 bucket=${process.env.PDS_BLOBSTORE_S3_BUCKET} endpoint=${process.env.PDS_BLOBSTORE_S3_ENDPOINT ?? 'AWS'}`
        : process.env.PDS_BLOB_STORE_LOCATION ?? 'tmpdir (ephemeral)'
    }`,
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
