/* eslint-env node */

'use strict'

const { PDS, envToCfg, envToSecrets, httpLogger, readEnv } = require('./dist')
const pkg = require('./package.json')

const main = async () => {
  const env = readEnv()
  env.version ??= pkg.version
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const pds = await PDS.create(cfg, secrets)

  await pds.start()

  httpLogger.info('pds is running')
}

main()
