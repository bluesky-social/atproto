enum PostType {
  QUOTE = 'quote',
  REPLY = 'reply',
  REPOST = 'repost',
}

export class PostTypeSet {
  static readonly POST_TYPE_VALUES = Object.values(PostType).map((v) =>
    v.valueOf(),
  )
  private set: Set<string>
  constructor(list?: string[]) {
    this.set = PostTypeSet.toDataSet(list ?? [])
  }
  hasQuote() {
    return this.has(PostType.QUOTE)
  }
  hasReply() {
    return this.has(PostType.REPLY)
  }
  hasRepost() {
    return this.has(PostType.REPOST)
  }
  has(type: string): boolean {
    return this.set.has(type)
  }
  private static toDataSet(postTypes: string[]): Set<string> {
    let set = new Set<string>()
    for (const postType of postTypes) {
      const normPostType = postType.toLowerCase()
      if (PostTypeSet.POST_TYPE_VALUES.includes(normPostType)) {
        set.add(normPostType)
      }
    }
    return set
  }
}
