window.VIDEOS = [
  {
    id: "night-worry-01",
    videoId: "GTr3L4h-Rzg",
    title: "잠들기 전 마음을 주님께 맡기는 기도",
    theme: "저녁기도",
    scripture: "시편 4편 8절",
    description: "하루 끝에 남은 걱정과 긴장을 내려놓고 평안으로 들어가도록 돕는 기도(유튜브)입니다.",
    tags: ["잠", "평안", "저녁기도"],
    publishedDate: "2026-07-01"
  },
  {
    id: "father-rest-01",
    videoId: "WgntGuOHd_I",
    title: "지친 마음을 위로하는 말씀과 기도",
    theme: "위로묵상",
    scripture: "마태복음 11장 28절",
    description: "수고하고 무거운 마음을 주님께 가져가며 조용히 회복을 구하는 묵상 영상입니다.",
    tags: ["위로", "쉼", "회복"],
    publishedDate: "2026-07-02"
  },
  {
    id: "wilderness-waiting-01",
    videoId: "hWJsflNXBFo",
    title: "기다림의 시간에 붙드는 말씀",
    theme: "큐티(QT)",
    scripture: "전도서 3장 11절",
    description: "조급한 마음을 내려놓고 하나님의 때를 신뢰하도록 돕는 말씀 묵상입니다.",
    tags: ["기다림", "믿음", "분별"],
    publishedDate: "2026-07-03"
  },
  {
    id: "esther-decision-01",
    videoId: "MwJp82Fqkno",
    title: "중요한 선택 앞에서 드리는 기도",
    theme: "아침기도",
    scripture: "잠언 3장 6절",
    description: "하루의 선택과 만남을 주님께 맡기며 지혜를 구하는 기도 영상입니다.",
    tags: ["선택", "지혜", "아침기도"],
    publishedDate: "2026-07-04"
  },
  {
    id: "abraham-waiting-01",
    videoId: "zVO-9RfgQio",
    title: "불안할 때 붙드는 하나님의 약속",
    theme: "말씀 붙들기",
    scripture: "이사야 41장 10절",
    description: "두려움이 커지는 날에도 주님의 동행과 약속을 다시 붙드는 기도(유튜브)입니다.",
    tags: ["불안", "약속", "동행"],
    publishedDate: "2026-07-05"
  },
  {
    id: "psalm139-rest-01",
    videoId: "TTSAyG4pTAM",
    title: "나를 아시는 하나님 안에서 쉬는 기도",
    theme: "회복기도",
    scripture: "시편 139편 1절",
    description: "나의 마음을 아시는 하나님 앞에서 숨지 않고 쉬도록 돕는 기도 영상입니다.",
    tags: ["회복", "쉼", "하나님"],
    publishedDate: "2026-07-06"
  },
  {
    id: "healing-night-01",
    videoId: "PwP1VXO7AxU",
    title: "상한 마음을 주님께 맡기는 밤기도",
    theme: "저녁기도",
    scripture: "시편 147편 3절",
    description: "상처와 피로를 주님께 맡기며 잠들기 전 마음을 정돈하는 밤기도입니다.",
    tags: ["상처", "치유", "밤기도"],
    publishedDate: "2026-07-07"
  }
].map((video) => ({
  ...video,
  url: video.url || `https://www.youtube.com/watch?v=${video.videoId}`,
  thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
}));
