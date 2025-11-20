const { build, dev, installPuppeteer, testShards } = require('./pnpm')
const { parseArgs, printHelp, run } = require('./run')
const { createTestInfraProxy, testDocker } = require('./test')

const COMMANDS = {
  build: { description: 'Build all packages in the workspace.', action: build },
  dev: { description: 'Run all packages in development mode.', action: dev },
  'install-puppeteer': {
    description: 'Install Puppeteer-managed browser if not in production.',
    action: installPuppeteer,
  },
  'with-test-db': {
    description: 'Run a command with a temporary test database.',
    action: createTestInfraProxy('with-test-db'),
    isProxy: true,
  },
  'with-test-redis-and-db': {
    description: 'Run a command with a temporary test database and Redis.',
    action: createTestInfraProxy('with-test-redis-and-db'),
    isProxy: true,
  },
  'test-shards': { description: 'Run test shards', action: testShards },
  'test-docker': {
    description:
      'Run commands in Docker test environment. If no command provided, runs bash.',
    action: testDocker,
  },
}

function main() {
  const rawArgs = process.argv.slice(2)

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp(COMMANDS)
    return
  }

  if (process.env.DEV_INFRA_CONTEXT === 'true') {
    let firstRealCommandIndex = 0
    for (const arg of rawArgs) {
      if (COMMANDS[arg]?.isProxy) {
        firstRealCommandIndex++
      } else {
        break
      }
    }

    const finalArgs = rawArgs.slice(firstRealCommandIndex)

    if (finalArgs.length === 0) {
      console.error(
        'Error: Executed inside dev-infra context but no final command was found.',
      )
      process.exit(1)
    }

    run(finalArgs.join(' '))
    return
  }

  const { command, commandArgs, envVars } = parseArgs(rawArgs)

  if (!command) {
    console.error('Error: No command provided.')
    printHelp(COMMANDS)
    process.exit(1)
  }

  const commandHandler = COMMANDS[command]
  if (!commandHandler) {
    console.error(`Error: Unknown command '${command}'.`)
    printHelp(COMMANDS)
    process.exit(1)
  }

  try {
    commandHandler.action(commandArgs, envVars)
  } catch (error) {
    console.error(`\nCommand '${command}' failed.`)
    process.exit(1)
  }
}

main()
