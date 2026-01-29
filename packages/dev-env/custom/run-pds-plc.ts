// packages/dev-env/custom/run-pds-plc.ts
import '../src/env' // Import env first to respect LOG_ENABLED
import { TestNetworkNoAppView } from '..'

async function main() {
  console.log('🚀 Starting PDS + PLC servers...\n')

  // Create PDS + PLC network (no bsky/appview)
  const network = await TestNetworkNoAppView.create({
    plc: {
      port: 3001,
    },
    pds: {
      port: 3000,
      hostname: 'localhost',
      inviteRequired: false, // No invite code needed
    },
  })

  console.log('✅ Servers running!')
  console.log(`📡 PLC server: ${network.plc.url}`)
  console.log(`📡 PDS server: ${network.pds.url}`)
  console.log(`📡 PDS DID: ${network.pds.ctx.cfg.service.did}\n`)
  console.log('💡 Connect your app to:', network.pds.url)
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
