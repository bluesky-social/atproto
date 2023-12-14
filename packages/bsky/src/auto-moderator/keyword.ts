export interface TextLabeler {
  labelText(text: string): Promise<string[]>
}

export class KeywordLabeler implements TextLabeler {
  constructor(public keywords: Record<string, string>) {}

  async labelText(text: string): Promise<string[]> {
    return keywordLabeling(this.keywords, text)
  }
}

export const keywordLabeling = (
  keywords: Record<string, string>,
  text: string,
): string[] => {
  const lowerText = text.toLowerCase()
  const labels: string[] = []
  for (const word of Object.keys(keywords)) {
    if (lowerText.includes(word)) {
      labels.push(keywords[word])
    }
  }
  return labels
}
