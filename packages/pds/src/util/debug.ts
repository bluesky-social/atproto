export const debugCatch = <Func extends (...args: any[]) => any>(fn: Func) => {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (err: any) {
      console.error({ ...err }, err.errno)
      throw err
    }
  }
}
