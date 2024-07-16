import { DidResolverBase } from './did-resolver-base.js'
import { DidPlcMethod, DidPlcMethodOptions } from './methods/plc.js'
import { DidWebMethod, DidWebMethodOptions } from './methods/web.js'
import { Simplify } from './util.js'

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
