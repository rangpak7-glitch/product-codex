import type { Metadata } from "next";
import { ContentPage } from "../../components/content-page";
export const metadata: Metadata = { title: "소개" };
export default function Page(){return <ContentPage eyebrow="소개" title="기도와 말씀을 생활 가까이에 두는 공간" description="기도의샘물은 듣고 지나가는 위로를 넘어 말씀을 읽고 다시 찾고 서로 나눌 수 있도록 돕습니다." tabs={[["목적","#purpose"],["활동","#activity"],["유튜브","#youtube"],["운영 원칙","#principles"]]} cards={[{title:"개설 목적",body:"생활의 여러 순간에 말씀과 기도를 어렵지 않게 찾도록 돕습니다."},{title:"주요 활동",body:"큐티, 말씀 붙들기, 아침·저녁기도, 영상, 자료와 나눔을 연결합니다."},{title:"유튜브",body:"유튜브는 듣는 입구, 웹사이트는 읽고 다시 찾고 나누는 공간입니다.",href:"/videos.html"},{title:"운영 원칙",body:"과장된 약속을 피하고 무료 콘텐츠와 확장 자료를 정직하게 구분합니다."}]} />}
