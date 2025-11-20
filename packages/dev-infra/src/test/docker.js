const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { safeRun } = require('./run')

function getRunningContainerId(composeFile, service) {
  const cmd = `docker compose -f "${composeFile}" ps --format json --status running`
  const rawJsonLines = safeRun(cmd)
  if (!rawJsonLines) return null

  try {
    const containers = rawJsonLines
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))

    const match = containers.find(
      (c) => c.Service === service || c.Name?.includes(service),
    )
    return match?.ID || null
  } catch (error) {
    console.warn(`Warning: Failed to parse Docker JSON output.`, error)
    const regex = new RegExp(`${service}.*?([0-9a-f]{12,})`, 'i')
    const match = rawJsonLines.match(regex)
    return match?.[1] ?? null
  }
}

function isDockerAvailable() {
  try {
    // Try multiple approaches to detect docker availability
    //execSync('docker --version > /dev/null 2>&1')
    execSync('docker ps > /dev/null 2>&1')
    return true
  } catch {
    return false
  }
}
function findRepoRoot(start = __dirname) {
  let dir = path.resolve(start)
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'Makefile'))) {
      return dir
    }
    dir = path.dirname(dir)
  }
  throw new Error('Could not find repository root.')
}
const composeFile = path.join(
  path.join(findRepoRoot(), 'packages', 'dev-infra'),
  'docker-compose.yaml',
)

function getDockerEnv() {
  return {
    PGPORT: '5433',
    PGHOST: 'localhost',
    PGUSER: 'pg',
    PGPASSWORD: 'password',
    PGDATABASE: 'postgres',
    DB_POSTGRES_URL: 'postgresql://pg:password@127.0.0.1:5433/postgres',
    REDIS_HOST: '127.0.0.1:6380',
  }
}

function startDocker(services) {
  execSync(
    `docker compose -f "${composeFile}" up --force-recreate -d ${services.join(' ')}`,
  )
}

function endDocker(services) {
  safeRun(
    `docker compose -f "${composeFile}" rm --force --stop --volumes ${services.join(' ')}`,
  )
}
module.exports = {
  composeFile,
  endDocker,
  getDockerEnv,
  getRunningContainerId,
  isDockerAvailable,
  startDocker,
}
