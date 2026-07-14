// Registers dd-trace's ESM loader hook for the rest of the process. Must be the
// first import so the hook is in place before any other module is resolved.
import 'dd-trace/register.js'
import ddTrace from 'dd-trace'

ddTrace.init({ logInjection: true })
