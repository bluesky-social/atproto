import { createContext, useContext } from 'react'

export type FormContextValue = {
  disabled: boolean
}

export const FormContext = createContext<FormContextValue>({
  disabled: false,
})
FormContext.displayName = 'FormContext'

export function useFormContext() {
  return useContext(FormContext)
}
