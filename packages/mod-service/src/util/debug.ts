export const debugCatch = <Func extends (...args: any[]) => any>(fn: Func) => {
  return async (...args: Parameters<Func>) => {
    try {
      return (await fn(...args)) as Awaited<ReturnType<Func>>
    } catch (err) {
      console.error(err)
      throw err
    }
  }
}
