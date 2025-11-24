const { execSync } = require('node:child_process')
const { run } = require('./run')

function build(_, env) {
  return run('pnpm run --recursive --stream "/^(build|build:.+)$/"', { env })
}

function dev(_, env) {
  const devEnv = { ...env, NODE_ENV: 'development' }
  return run('pnpm run --recursive --parallel --stream "/^(dev|dev:.+)$/"', {
    env: devEnv,
  })
}

function installPuppeteer(_, env) {
  if (
    process.env.CI ||
    process.env.npm_config_production === 'true' ||
    process.env.puppeteer_skip_chromium_download === 'true'
  ) {
    return
  }
  return run('npx puppeteer browsers install chrome', { env })
}

function testShards() {
  for (let i = 1; i <= 8; i++) {
    const cmd =
      `pnpm test:withFlags ` +
      `--passWithNoTests ` +
      `--maxWorkers=1 ` +
      `--shard ${i}/8 `

    execSync(cmd, { stdio: 'inherit' })
  }
}

module.exports = {
  build,
  dev,
  installPuppeteer,
  testShards,
}
