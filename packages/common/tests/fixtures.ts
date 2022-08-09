const TOTAL_POST_COUNT = 100
const TOTAL_LIKE_COUNT = 100

const arrSpan = (count: number): number[] => {
  const arr: number[] = []
  for (let i = 0; i < count; i++) {
    arr.push(i)
  }
  return arr
}

export const posts = arrSpan(100).map((num) => ({ name: `post${num}` }))
export const posts1 = posts.slice(0, Math.floor(TOTAL_POST_COUNT / 2))
export const posts2 = posts.slice(Math.floor(TOTAL_POST_COUNT / 2))

export const likes = arrSpan(100).map((num) => ({ name: `like${num}` }))
export const likes1 = likes.slice(0, Math.floor(TOTAL_LIKE_COUNT / 2))
export const likes2 = likes.slice(Math.floor(TOTAL_LIKE_COUNT / 2))
