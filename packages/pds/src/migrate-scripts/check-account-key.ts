import { envToCfg, envToSecrets, readEnv } from '../config'
import AppContext from '../context'

const run = async () => {
  const did = process.argv[2]
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)
  const keypair = await ctx.actorStore.keypair(did)
  console.log(keypair.did())
}

run()
