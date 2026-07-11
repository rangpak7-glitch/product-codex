import type { Metadata } from "next"; import { ContentPage } from "../../components/content-page";
export const metadata: Metadata={title:"저녁기도"};
export default function Page(){return <ContentPage eyebrow="기도" title="하루를 내려놓는 저녁기도" description="남아 있는 염려와 후회를 주님께 맡기며 잠들기 전 마음을 조용히 정돈합니다." tabs={[["감사기도","/prayers.html?category=감사"],["저녁기도","/night-prayer.html"],["아침기도","/morning-prayer.html"]]} cards={[{scripture:"시편 4편 8절",title:"오늘의 저녁기도",body:"내일의 걱정이 오늘의 쉼을 빼앗지 않도록 주님께 마음을 맡깁니다."},{title:"잠들기 전 듣기",body:"관련 밤기도 영상을 유튜브에서 차분히 들을 수 있습니다.",href:"/videos.html"}]} />}
