import { createContext, useContext } from 'react'

export type FieldsetContextValue = {
  disabled: boolean
  labelId?: string
}

export const FieldsetContext = createContext<FieldsetContextValue>({
  disabled: false,
})
FieldsetContext.displayName = 'FieldsetContext'

export function useFieldsetContext() {
  return useContext(FieldsetContext)
}
