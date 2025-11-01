const { execSync } = require('node:child_process')
const path = require('node:path')

function runDockerTest(command) {
  const testComposeFile = path.join(__dirname, 'docker-test-runner-compose.yaml')

  // Start all services including db_test and redis_test in the same compose file
  execSync(`docker compose -f "${testComposeFile}" up -d --build --wait`, {
    stdio: 'inherit',
  })

  try {
    // First, copy code from /mnt/code to /app, excluding node_modules
    execSync(
      `docker compose -f "${testComposeFile}" exec docker_test_env copy-code.sh`,
      { stdio: 'inherit' },
    )

    // Then run the actual command
    execSync(
      `docker compose -f "${testComposeFile}" exec -e DB_POSTGRES_URL=postgresql://pg:password@db_test:5432/postgres -e REDIS_HOST=redis_test:6379 -e NO_SANDBOX=true docker_test_env sh -c "${command}"`,
      { stdio: 'inherit' },
    )
  } finally {
    execSync(`docker compose -f "${testComposeFile}" down`, { stdio: 'inherit' })
  }
}

function main() {
  const args = process.argv.slice(2)
  const command = args.length > 0 ? args.join(' ') : 'bash'
  runDockerTest(command)
}

if (require.main === module) {
  main()
}

module.exports = { runDockerTest }
