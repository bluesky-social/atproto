const { execSync } = require('node:child_process')

function run(command, options = {}) {
  console.log(`\n> ${command}\n`)
  execSync(command, {
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
  })
}

function parseArgs(argv) {
  const envVars = {}
  const positionalArgs = []
  for (const arg of argv) {
    if (arg.startsWith('--env=')) {
      const [key, ...valueParts] = arg.substring(6).split('=')
      if (key && valueParts.length > 0) {
        envVars[key] = valueParts.join('=')
      }
    } else {
      positionalArgs.push(arg)
    }
  }
  const [command, ...commandArgs] = positionalArgs
  return { command: command || null, commandArgs, envVars }
}

function printHelp(commands) {
  console.log('Usage: pnpm workspace-cli <command> [options]\n')
  console.log('Available commands:')
  for (const [cmd, { description }] of Object.entries(commands)) {
    console.log(`  ${cmd.padEnd(25)} ${description}`)
  }
  console.log('\nOptions:')
  console.log('  --env=KEY=VALUE     Set environment variables for the command')
  console.log('  --help              Show this help message')
  console.log('\nExamples:')
  console.log('  pnpm workspace-cli build')
  console.log('  pnpm workspace-cli with-test-db jest')
  console.log('  pnpm workspace-cli --env=FOO=bar build')
}

module.exports = { parseArgs, printHelp, run }
