export type ContentKind = "editorial" | "word" | "morning" | "evening" | "video";

export interface ContentItem {
  id: string;
  kind: ContentKind;
  title: string;
  summary: string;
  scripture?: string;
  publishedDate?: string;
  href: string;
  tags?: string[];
  relatedContentIds?: string[];
}

export interface ResourceProduct {
  id: string;
  resourceId: string | null;
  type: "pdf" | "audio" | "card" | "journey";
  title: string;
  summary: string;
  previewItems: string[];
  salesStatus: "inquiry" | "available" | "unavailable";
  priceKrw: number | null;
  purchasable: boolean;
}

export interface VideoItem {
  id: string;
  videoId: string;
  title: string;
  theme: string;
  scripture: string;
  summary: string;
  publishedDate: string;
}

export interface ChannelPost {
  id: string;
  title: string;
  body: string;
  publishedDate: string;
  relatedVideoId?: string;
  youtubePostUrl?: string;
}
