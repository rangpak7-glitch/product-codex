import type { Metadata } from "next"; import { ContentPage } from "../../components/content-page";
export const metadata: Metadata={title:"오늘의 큐티(QT)"};
export default function Page(){return <ContentPage eyebrow="성경말씀" title="오늘의 큐티(QT)" description="성경의 배경과 오늘의 현실을 연결해 깨달음과 적용을 찾는 사설형 묵상입니다." tabs={[["오늘의 큐티","/meditation.html"],["말씀 붙들기","/prayers.html"]]} cards={[{scripture:"시편 46편 10절",title:"멈춤 속에서 다시 듣는 말씀",body:"분주함을 잠시 내려놓고 오늘의 선택을 말씀 앞에 비추어 봅니다."},{title:"오늘의 적용 질문",body:"지금 내가 멈추고 하나님께 맡겨야 할 한 가지는 무엇인가요?"}]} />}
