const { runTestInfra } = require('../test')
const { runDockerTest } = require('../test/docker-test-runner')

const createTestInfraProxy = (mode) => async (commandArgs, env) => {
  if (commandArgs.length === 0) {
    console.error(`Error: The '${mode}' command requires a subcommand.`)
    console.error(`Example: pnpm workspace-script ${mode} pnpm test`)
    process.exit(1)
  }

  const testInfraEnv = { ...process.env, ...env }
  process.env = testInfraEnv

  const exitCode = await runTestInfra(mode, commandArgs)
  process.exit(exitCode)
}

function testDocker(commandArgs) {
  const command = commandArgs.length > 0 ? commandArgs.join(' ') : 'bash'
  runDockerTest(command)
}

module.exports = {
  createTestInfraProxy,
  testDocker,
}
