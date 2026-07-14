import { useEffect, useState } from 'react'

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

export function useIsDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(mediaQuery.matches)

  useEffect(() => {
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDarkMode(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return isDarkMode
}
