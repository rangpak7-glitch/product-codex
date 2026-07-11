import type { ReactNode } from "react";

type NavGroup = { label: string; links: ReadonlyArray<readonly [string, string]> };

const groups: ReadonlyArray<NavGroup> = [
  { label: "성경말씀", links: [["오늘의 큐티(QT)", "/meditation.html"], ["말씀 붙들기", "/prayers.html"]] },
  { label: "기도", links: [["감사기도", "/prayers.html?category=감사"], ["저녁기도", "/night-prayer.html"], ["아침기도", "/morning-prayer.html"]] },
  { label: "유튜브", links: [["영상", "/videos.html?tab=videos"], ["채널 소식", "/videos.html?tab=posts"]] },
  { label: "신앙자료", links: [["기도문 PDF", "/prayer-cards.html?type=pdf"], ["기도 오디오북", "/prayer-cards.html?type=audio"], ["기도카드", "/prayer-cards.html?type=card"]] }
];

export function SiteShell({ children }: { children: ReactNode }) {
  return <>
    <header className="shellHeader">
      <a className="shellBrand" href="/"><img src="/assets/logo-sam.png" alt="" width="44" height="44" /><span><strong>기도의샘물</strong><small>기도와 말씀으로 쉬어가는 곳</small></span></a>
      <nav className="shellNav" aria-label="주요 메뉴">
        {groups.slice(0, 2).map((group) => <details key={group.label}><summary>{group.label}</summary><div>{group.links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div></details>)}
        <a href="/community.html">나눔게시판</a>
        {groups.slice(2).map((group) => <details key={group.label}><summary>{group.label}</summary><div>{group.links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div></details>)}
      </nav>
      <div className="shellUtility"><a href="/about.html">소개</a><a href="/contact.html">문의</a></div>
      <details className="mobileMenu"><summary aria-label="전체 메뉴 열기">메뉴</summary><div>{groups.flatMap((group) => group.links).map(([label, href]) => <a key={href} href={href}>{label}</a>)}<a href="/community.html">나눔게시판</a><a href="/about.html">소개</a><a href="/contact.html">문의하기</a></div></details>
    </header>
    <main>{children}</main>
    <footer className="shellFooter"><div><strong>기도의샘물</strong><p>말씀과 기도로 마음이 잠시 쉬어가는 신앙 콘텐츠 공간입니다.</p></div><div><strong>말씀과 기도</strong><a href="/meditation.html">오늘의 큐티</a><a href="/prayers.html">말씀 붙들기</a><a href="/morning-prayer.html">아침기도</a><a href="/night-prayer.html">저녁기도</a></div><div><strong>함께 둘러보기</strong><a href="/community.html">나눔게시판</a><a href="/videos.html">유튜브</a><a href="/prayer-cards.html">신앙자료</a></div><div><strong>운영과 정책</strong><a href="/about.html">소개</a><a href="/contact.html">문의하기</a><a href="/privacy.html">개인정보처리방침</a></div></footer>
  </>;
}

export function PageHero({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <section className="pageHero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p>{actions ? <div className="actions">{actions}</div> : null}</section>;
}

export function Section({ eyebrow, title, children, id }: { eyebrow: string; title: string; children: ReactNode; id?: string }) {
  return <section className="section" id={id}><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children}</section>;
}
