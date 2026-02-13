export type Events = {
  'experiment:viewed': {
    experimentId: string
    variationId: string
  }
  'feature:viewed': {
    featureId: string
    featureResultValue: unknown
    /** Only available if feature has experiment rules applied */
    experimentId?: string
    /** Only available if feature has experiment rules applied */
    variationId?: string
  }
}
