import * as WebBrowser from 'expo-web-browser'
import { useEffect } from 'react'

export function useBrowserWarmUp(shouldWarmUp: boolean) {
  useEffect(() => {
    if (shouldWarmUp) {
      void WebBrowser.warmUpAsync().catch((err) => {
        console.warn('Error warming up web browser:', err)
      })
      return () => {
        void WebBrowser.coolDownAsync().catch((err) => {
          console.warn('Error cooling down web browser:', err)
        })
      }
    }
  }, [shouldWarmUp])
}
