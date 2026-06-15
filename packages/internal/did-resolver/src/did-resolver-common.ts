import { DidResolverBase } from './did-resolver-base.ts'
import { DidPlcMethod, type DidPlcMethodOptions } from './methods/plc.ts'
import { DidWebMethod, type DidWebMethodOptions } from './methods/web.ts'
import type { Simplify } from './util.ts'

export type DidResolverCommonOptions = Simplify<
  DidPlcMethodOptions & DidWebMethodOptions
>

export class DidResolverCommon
  extends DidResolverBase<'plc' | 'web'>
  implements DidResolverBase<'plc' | 'web'>
{
  constructor(options?: DidResolverCommonOptions) {
    super({
      plc: new DidPlcMethod(options),
      web: new DidWebMethod(options),
    })
  }
}
