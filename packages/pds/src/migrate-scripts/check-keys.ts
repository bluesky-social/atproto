import dotenv from 'dotenv'
import { envToCfg, envToSecrets, readEnv } from '../config'
import AppContext from '../context'

dotenv.config()

const run = async () => {
  const env = readEnv()
  const cfg = envToCfg(env)
  const secrets = envToSecrets(env)
  const ctx = await AppContext.fromConfig(cfg, secrets)
  const reserved = await ctx.actorStore.getReservedKeypair(
    'did:plc:wqzurwm3kmaig6e6hnc2gqwo',
  )
  console.log(reserved?.did())
  const key = await ctx.actorStore.keypair('did:plc:wqzurwm3kmaig6e6hnc2gqwo')
  console.log(key?.did())
}

run()
