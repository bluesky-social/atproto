import AppContext from '../../context'
import { Recoverer } from './recoverer'

export const sequencerRecovery = async (ctx: AppContext, args: string[]) => {
  const cursor = args[0] ? parseInt(args[0]) : 0
  const concurrency = args[1] ? parseInt(args[1]) : 10
  const recover = new Recoverer(ctx, {
    cursor,
    concurrency,
  })
  await recover.run()
}
