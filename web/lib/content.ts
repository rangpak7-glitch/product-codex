import type { ContentItem, ResourceProduct, VideoItem } from "./types";

export const featuredContent: ContentItem[] = [
  { id: "today-qt", kind: "editorial", title: "오늘의 큐티(QT)", summary: "성경 이야기와 오늘의 삶을 연결해 천천히 읽는 묵상입니다.", scripture: "시편 46편 10절", href: "/meditation.html" },
  { id: "gratitude-prayer", kind: "word", title: "감사를 회복하는 기도", summary: "평범한 하루 속 이미 받은 은혜를 다시 바라봅니다.", scripture: "데살로니가전서 5장 18절", href: "/prayers.html?category=감사" }
];

export const resources: ResourceProduct[] = [
  { id: "anxiety-prayer-pdf", resourceId: "anxiety-prayer-pdf", type: "pdf", title: "불안 내려놓기 기도문", summary: "불안과 걱정을 말씀 앞으로 가져가도록 돕는 기도문입니다.", previewItems: ["평안을 구하는 짧은 기도", "걱정을 내려놓는 묵상 질문", "결정 앞의 고백"], salesStatus: "inquiry", priceKrw: null, purchasable: false },
  { id: "night-peace-audio", resourceId: "night-peace-audio", type: "audio", title: "잠들기 전 평안 기도 오디오북", summary: "잠들기 전 염려를 내려놓고 말씀 안에서 쉬도록 돕습니다.", previewItems: ["밤의 염려를 내려놓는 기도", "평안을 구하는 말씀 낭독"], salesStatus: "inquiry", priceKrw: null, purchasable: false },
  { id: "peace-card-thread", resourceId: "peace-card-thread", type: "card", title: "불안을 내려놓는 14일 말씀 카드", summary: "불안이 올라오는 날 한 장씩 붙드는 말씀·기도카드입니다.", previewItems: ["두려움보다 큰 평안", "오늘의 걱정 맡기기"], salesStatus: "inquiry", priceKrw: null, purchasable: false }
];

export const videos: VideoItem[] = [
  { id: "night-worry-01", videoId: "GTr3L4h-Rzg", title: "잠들기 전 마음을 주님께 맡기는 기도", theme: "저녁기도", scripture: "시편 4편 8절", summary: "하루 끝에 남은 걱정을 내려놓고 평안으로 들어가는 기도입니다.", publishedDate: "2026-07-01" },
  { id: "father-rest-01", videoId: "WgntGuOHd_I", title: "지친 마음을 위로하는 말씀과 기도", theme: "위로묵상", scripture: "마태복음 11장 28절", summary: "수고하고 무거운 마음을 주님께 가져갑니다.", publishedDate: "2026-07-02" },
  { id: "esther-decision-01", videoId: "MwJp82Fqkno", title: "중요한 선택 앞에서 드리는 기도", theme: "아침기도", scripture: "잠언 3장 6절", summary: "하루의 선택과 만남을 맡기며 지혜를 구합니다.", publishedDate: "2026-07-04" }
];
