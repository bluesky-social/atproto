export async function sleep(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay))
}
