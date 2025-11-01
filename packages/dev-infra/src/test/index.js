const process = require('node:process')
const {
  composeFile,
  endDocker,
  getDockerEnv,
  getRunningContainerId,
  isDockerAvailable,
  startDocker,
} = require('./docker')
const { pgClear, pgInit } = require('./psql')
const { runCommandWithCleanup, safeRun } = require('./run')

async function mainDocker(services, commandWithArgs) {
  let didStartServices = false
  if (
    // If any of the required services are not running, start them
    services.filter((s) => !getRunningContainerId(composeFile, s)).length > 0
  ) {
    startDocker(services)
    didStartServices = true
  } else {
    console.log(`All services (${services.join(', ')}) are already running.`)
  }

  const [cmd, ...args] = commandWithArgs

  return runCommandWithCleanup(cmd, args, {
    env: { ...process.env, ...getDockerEnv() },
    onCleanup: () => {
      if (didStartServices) {
        endDocker(services)
      }
    },
  })
}

async function mainNative(services, commandWithArgs) {
  const pgUrl = process.env.DB_TEST_POSTGRES_URL || process.env.DB_POSTGRES_URL
  const redisHost = process.env.REDIS_TEST_HOST || process.env.REDIS_HOST

  if (!pgUrl) {
    console.error(
      'Error: Missing Postgres connection URL. Set DB_TEST_POSTGRES_URL or DB_POSTGRES_URL.',
    )
    return 1
  }

  console.log(`Using ${pgUrl} to connect to postgres.`)
  if (services.includes('db_test')) {
    pgInit(pgUrl)
  }

  if (redisHost) console.log(`Using ${redisHost} to connect to redis.`)
  else if (services.includes('redis_test')) {
    console.warn('Warning: Redis is required but REDIS_TEST_HOST is not set.')
  }

  const [cmd, ...args] = commandWithArgs

  return runCommandWithCleanup(cmd, args, {
    env: { ...process.env, DB_POSTGRES_URL: pgUrl, REDIS_HOST: redisHost },
    onCleanup: () => {
      if (pgUrl) {
        pgClear(pgUrl)
      }
      if (redisHost) {
        safeRun(`redis-cli -u "redis://${redisHost}" flushall`)
      }
    },
  })
}

async function runTestInfra(mode, commandWithArgs) {
  const services = {
    'with-test-db': ['db_test'],
    'with-test-redis-and-db': ['db_test', 'redis_test'],
  }[mode]

  if (isDockerAvailable()) {
    return await mainDocker(services, commandWithArgs)
  } else {
    console.log('Docker unavailable. Running on host.')
    return await mainNative(services, commandWithArgs)
  }
}

module.exports = {
  mainDocker,
  mainNative,
  runTestInfra,
}
