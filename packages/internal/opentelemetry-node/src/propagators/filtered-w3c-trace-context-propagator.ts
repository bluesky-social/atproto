import type { Context, TextMapGetter } from '@opentelemetry/api'
import { W3CTraceContextPropagator } from '@opentelemetry/core'

export class FilteredW3CTraceContextPropagator extends W3CTraceContextPropagator {
  extract(context: Context, carrier: unknown, getter: TextMapGetter) {
    if (this.shouldPropagate(context, carrier, getter)) {
      return super.extract(context, carrier, getter)
    }
    return context
  }

  shouldPropagate(
    _context: Context,
    _carrier: unknown,
    _getter: TextMapGetter,
  ) {
    // Implement your logic to determine if the trace context should
    // be propagated. For now, we assume the service is public and
    // do not propagate.

    // @NOTE using IP based logic would require:
    // https://github.com/open-telemetry/opentelemetry-js/pull/6902
    return false
  }
}
