/**
* GENERATED CODE - DO NOT MODIFY
*/
/** A list of media embedded in a post or document. */
export interface Main {
  media: MediaEmbed[];
  [k: string]: unknown;
}

export interface MediaEmbed {
  alt?: string;
  thumb?: { cid: string, mimeType: string, [k: string]: unknown };
  original: { cid: string, mimeType: string, [k: string]: unknown };
  [k: string]: unknown;
}
