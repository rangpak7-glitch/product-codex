import { PageHero, Section } from "./site-shell";

export function ContentPage({ eyebrow, title, description, tabs, cards }: { eyebrow: string; title: string; description: string; tabs: Array<[string,string]>; cards: Array<{ title:string; body:string; scripture?:string; href?:string }> }) {
  return <><PageHero eyebrow={eyebrow} title={title} description={description} /><Section eyebrow="둘러보기" title="원하는 내용을 찾아보세요"><div className="tagRow">{tabs.map(([label,href]) => <a className="tag" href={href} key={href}>{label}</a>)}</div><div className="grid two">{cards.map((card) => <article className="card" key={card.title}>{card.scripture ? <p className="eyebrow">{card.scripture}</p> : null}<h3>{card.title}</h3><p>{card.body}</p>{card.href ? <a href={card.href}>자세히 보기</a> : null}</article>)}</div></Section></>;
}
