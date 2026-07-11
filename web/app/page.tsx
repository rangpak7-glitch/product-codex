import { PageHero, Section } from "../components/site-shell";
import { featuredContent, resources, videos } from "../lib/content";

export default function HomePage() {
  return <>
    <PageHero eyebrow="오늘도 말씀과 기도로" title="오늘의 말씀과 기도로, 마음이 잠시 쉬어가는 곳" description="성경말씀과 아침·저녁기도, 유튜브 영상, 오래 곁에 둘 신앙자료를 한곳에서 편안하게 읽고 들을 수 있습니다." actions={<><a className="button" href="#resources">대표 신앙자료 둘러보기</a><a className="button secondary" href="#today">오늘의 무료 기도 읽기</a></>} />
    <Section eyebrow="오늘의 말씀과 기도" title="지금 마음에 천천히 머물러 보세요" id="today"><div className="grid two">{featuredContent.map((item) => <article className="card" key={item.id}><p className="eyebrow">{item.scripture}</p><h3>{item.title}</h3><p>{item.summary}</p><a href={item.href}>전문 읽기</a></article>)}</div></Section>
    <Section eyebrow="신앙자료" title="읽고, 듣고, 저장하며 곁에 두는 자료" id="resources"><div className="resourceGrid">{resources.map((resource) => <article className="card" key={resource.id}><p className="eyebrow">{resource.type === "pdf" ? "기도문 PDF" : resource.type === "audio" ? "기도 오디오북" : "기도카드"}</p><h3>{resource.title}</h3><p>{resource.summary}</p><ul>{resource.previewItems.map((item) => <li key={item}>{item}</li>)}</ul><a href={`/prayer-cards.html?resource=${resource.resourceId}`}>공개 미리보기</a><a href={`/contact.html?product=${resource.id}`}>자료 문의하기</a></article>)}</div></Section>
    <Section eyebrow="원하는 방식으로" title="콘텐츠 둘러보기"><div className="grid">{[["성경말씀","/meditation.html"],["기도","/morning-prayer.html"],["유튜브","/videos.html"],["신앙자료","/prayer-cards.html"],["나눔게시판","/community.html"]].map(([label,href]) => <article className="card" key={href}><h3>{label}</h3><p>필요한 콘텐츠를 한눈에 찾고 관련 말씀과 기도로 이어갑니다.</p><a href={href}>둘러보기</a></article>)}</div></Section>
    <Section eyebrow="유튜브" title="최신 기도와 말씀 영상"><div className="grid">{videos.map((video) => <article className="card" key={video.id}><a className="videoThumb" href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noreferrer"><img src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`} alt="" /></a><p className="eyebrow">{video.theme}</p><h3>{video.title}</h3><p>{video.summary}</p></article>)}</div></Section>
  </>;
}
