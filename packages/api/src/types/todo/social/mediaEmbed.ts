/**
* GENERATED CODE - DO NOT MODIFY
* Created Wed Sep 21 2022
*/
export interface Record {
  media: MediaEmbed[];
  [k: string]: unknown;
}
export interface MediaEmbed {
  alt?: string;
  thumb?: MediaEmbedBlob;
  original: MediaEmbedBlob;
  [k: string]: unknown;
}
export interface MediaEmbedBlob {
  mimeType: string;
  blobId: string;
  [k: string]: unknown;
}
