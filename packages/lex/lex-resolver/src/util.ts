export const canParseUrl =
  URL.canParse ??
  ((url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  })
