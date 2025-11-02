#!/usr/bin/env node
/**
 * Development server starter for PDS
 * This is a simple wrapper to start the PDS server for local development
 */

// Load environment variables from .env file
require('dotenv').config()

const { PDS, envToCfg, envToSecrets, readEnv } = require('./dist/index.js')

async function main() {
  try {
    console.log('🚀 Starting PDS server...\n')

    // Read environment configuration
    const env = readEnv()
    const cfg = envToCfg(env)
    const secrets = envToSecrets(env)

    // Create and start PDS
    const server = await PDS.create(cfg, secrets)
    await server.start()

    console.log('✅ PDS Server started successfully!\n')
    console.log(
      `🌐 Server URL: http://${cfg.service.hostname}:${cfg.service.port}`,
    )
    console.log(`📍 Hostname: ${cfg.service.hostname}`)
    console.log(`🔌 Port: ${cfg.service.port}\n`)
    console.log('Press Ctrl+C to stop the server\n')

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down PDS server...')
      await server.destroy()
      console.log('✅ Server stopped')
      process.exit(0)
    }

    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
  } catch (error) {
    console.error('❌ Failed to start PDS server:', error)
    process.exit(1)
  }
}

main()
