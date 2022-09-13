export interface Record {
  media: MediaEmbed[];
}
export interface MediaEmbed {
  alt?: string;
  thumb?: MediaEmbedBlob;
  original: MediaEmbedBlob;
}
export interface MediaEmbedBlob {
  mimeType: string;
  blobId: string;
}
