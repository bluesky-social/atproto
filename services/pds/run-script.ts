import { AppContext, scripts } from '@atproto/pds'

const main = async () => {
  const ctx = await AppContext.fromEnv()
  const scriptName = process.argv[2]
  const script:
    undefined | ((ctx: AppContext, args: string[]) => Promise<void>) =
    Object.hasOwn(scripts, scriptName)
      ? scripts[scriptName as keyof typeof scripts]
      : undefined
  if (!script) {
    throw new Error(`could not find script: ${scriptName}`)
  }
  await script(ctx, process.argv.slice(3))
  console.log('DONE')
}

main()
