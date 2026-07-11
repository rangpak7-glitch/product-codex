import type { Metadata } from "next"; import { ContentPage } from "../../components/content-page";
export const metadata: Metadata={title:"말씀 붙들기"};
export default function Page(){return <ContentPage eyebrow="성경말씀" title="현실의 하루에서 말씀 붙들기" description="마음의 상황에 가까운 말씀과 짧은 해설, 기도로 오늘의 한 걸음을 정돈합니다." tabs={[["오늘의 큐티","/meditation.html"],["말씀 붙들기","/prayers.html"],["감사기도","/prayers.html?category=감사"]]} cards={[{scripture:"베드로전서 5장 7절",title:"불안한 마음에",body:"해결되지 않은 문제보다 주님의 신실하심을 먼저 바라봅니다."},{scripture:"데살로니가전서 5장 18절",title:"감사를 회복하는 기도",body:"부족한 것만 보던 마음을 돌이켜 이미 받은 은혜를 기억합니다."}]} />}
