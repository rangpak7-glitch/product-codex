import type { Metadata } from "next"; import { ContentPage } from "../../components/content-page";
export const metadata: Metadata={title:"아침기도"};
export default function Page(){return <ContentPage eyebrow="기도" title="하루를 여는 아침기도" description="말과 생각, 일정과 만남을 주님께 맡기며 감사와 믿음으로 하루를 시작합니다." tabs={[["감사기도","/prayers.html?category=감사"],["저녁기도","/night-prayer.html"],["아침기도","/morning-prayer.html"]]} cards={[{scripture:"시편 118편 24절",title:"오늘의 아침기도",body:"오늘이라는 하루를 선물로 받고 작은 친절과 평안을 선택합니다."},{title:"최근 아침기도",body:"날짜별 아침기도는 아카이브에서 다시 찾아볼 수 있습니다.",href:"/archive.html"}]} />}
