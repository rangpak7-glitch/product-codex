const VIDEOS = [
  {
    id: "night-worry-01",
    videoId: "GTr3L4h-Rzg",
    title: "염려가 내려놓아지지 않는 밤",
    theme: "수면 치유기도",
    scripture: "베드로전서 5장 7절",
    description: "내려놓고 싶은데 내려놓아지지 않는 염려를 주님의 능하신 손 아래 맡기는 밤기도입니다."
  },
  {
    id: "father-rest-01",
    videoId: "WgntGuOHd_I",
    title: "아버지 품의 안식",
    theme: "은혜와 쉼",
    scripture: "갈라디아서 4장 6절",
    description: "종교적 의무감으로 지친 마음이 아바 아버지의 은혜 안에서 쉬도록 돕는 말씀과 기도입니다."
  },
  {
    id: "wilderness-waiting-01",
    videoId: "hWJsflNXBFo",
    title: "기다림 속에서 나를 빚으시는 하나님",
    theme: "광야와 기다림",
    scripture: "이사야 43장",
    description: "끝나지 않는 광야 같은 현실 속에서 조급함을 내려놓고 하나님의 시간표를 신뢰하는 묵상입니다."
  },
  {
    id: "esther-decision-01",
    videoId: "MwJp82Fqkno",
    title: "중요한 결단 앞에 잠 못 드는 밤",
    theme: "결단과 위탁",
    scripture: "에스더 4장 16절",
    description: "중요한 선택 앞에서 모든 시나리오를 내려놓고 하나님의 주권 안으로 들어가는 말씀묵상입니다."
  },
  {
    id: "abraham-waiting-01",
    videoId: "zVO-9RfgQio",
    title: "아브라함의 25년",
    theme: "막막함과 약속",
    scripture: "창세기 15장",
    description: "사방이 막힌 것 같은 시간에도 하나님이 기다림 속에서 우리를 빚고 계심을 묵상합니다."
  },
  {
    id: "psalm139-rest-01",
    videoId: "TTSAyG4pTAM",
    title: "인생 후반전, 무거운 생각을 내려놓는 밤기도",
    theme: "시편 139편 안식기도",
    scripture: "시편 139편",
    description: "무거운 생각을 잠시 내려놓고 하나님이 여전히 나를 아시고 붙드신다는 평안을 누리는 밤기도입니다."
  },
  {
    id: "healing-night-01",
    videoId: "PwP1VXO7AxU",
    title: "몸이 아프고 노화가 두려울 때",
    theme: "침상 치유 밤기도",
    scripture: "이사야 53장",
    description: "육신의 통증과 노화의 두려움 앞에서 주님의 위로와 회복을 구하는 밤기도와 말씀 낭독입니다."
  }
].map((video) => ({
  ...video,
  url: `https://www.youtube.com/watch?v=${video.videoId}`,
  thumbnail: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
}));
