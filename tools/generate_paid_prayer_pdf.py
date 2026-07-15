from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


OUTPUT_DIR = Path(r"D:/codex/sinang/prayPDF")
PAID_OUTPUT = OUTPUT_DIR / "가정을_품는_14일_기도_유료본.pdf"
PREVIEW_OUTPUT = OUTPUT_DIR / "가정을_품는_14일_기도_미리보기.pdf"

PAGE_W, PAGE_H = A4
MARGIN_X = 52
TOTAL_PAGES = 33

DEEP_NAVY = HexColor("#0C1930")
NAVY = HexColor("#172842")
IVORY = HexColor("#FCFAF5")
BEIGE = HexColor("#F3E8D0")
GOLD = HexColor("#B8893B")
SAGE = HexColor("#D8E2D5")
MUTED = HexColor("#46546A")
LINE = HexColor("#BFAF93")
WHITE = HexColor("#FFFFFF")

# The verified large-print setting: all text is Malgun Gothic Bold, +1pt,
# 96% horizontal scale, and a subtle 0.2pt tracking adjustment.
TYPE_SCALE = 1
HORIZONTAL_SCALE = 96
CHAR_SPACE = 0.2
BOLD = "MalgunGothicBold"
SANS = BOLD
SERIF = BOLD


MATERIAL_INFO = {
    "title": "가정을 품는 14일 기도",
    "summary": "자녀와 가정, 오늘의 마음을 위해 말씀을 읽고 기도하며 기록하는 14일 여정입니다.",
    "keywords": ["자녀", "가정", "걱정", "위로", "감사", "결심"],
    "description": "매일 개역한글 성경 본문과 짧은 묵상, 직접 읽는 기도문을 차례로 만나고, 충분한 기록 공간에 마음을 남깁니다. 혼자 또는 가족과 함께 천천히 읽고, 오늘 할 수 있는 작은 실천으로 이어 가도록 구성했습니다.",
    "price": "4,900원",
    "use_scope": "개인·가정용 PDF",
}


# Scripture wording below was transcribed without modernization from the
# Korean Revised Version (개역한글, 1961) and checked verse-by-verse.
DAYS = [
    {
        "number": "DAY 1",
        "topic": "자녀의 믿음",
        "title": "자녀의 믿음을 위한 기도",
        "reference": "신명기 6:6-7",
        "scripture": [
            "6 오늘날 내가 네게 명하는 이 말씀을 너는 마음에 새기고",
            "7 네 자녀에게 부지런히 가르치며 집에 앉았을 때에든지 길에 행할 때에든지 누웠을 때에든지 일어날 때에든지 이 말씀을 강론할 것이며",
        ],
        "meditation": "자녀의 믿음은 부모가 통제하거나 대신 만들어 줄 수 있는 일이 아닙니다. 오늘도 하나님께서 자녀의 마음 가까이에서 일하심을 신뢰하며 기도합니다.",
        "prayer": "사랑의 하나님, 제 자녀를 주님의 손에 올려드립니다. 세상의 많은 목소리 가운데서도 진실하고 선한 길을 분별하게 하시고, 기쁠 때나 힘들 때나 주님께 마음을 열게 하소서. 제가 조급함으로 자녀를 밀어붙이기보다, 믿음으로 기다리고 사랑으로 곁을 지키게 하소서. 자녀의 걸음마다 주님의 은혜가 함께하기를 구합니다.",
        "prompt": "오늘 자녀를 위해 하나님께 특별히 맡기고 싶은 마음은 무엇인가요?",
        "practice": "자녀에게 짧게라도 ‘늘 너를 위해 기도하고 있어’라고 전해 보세요.",
    },
    {
        "number": "DAY 2",
        "topic": "자녀의 하루",
        "title": "자녀의 하루를 위한 기도",
        "reference": "시편 121:7-8",
        "scripture": [
            "7 여호와께서 너를 지켜 모든 환난을 면케 하시며 또 네 영혼을 지키시리로다",
            "8 여호와께서 너의 출입을 지금부터 영원까지 지키시리로다",
        ],
        "meditation": "평범해 보이는 하루에도 자녀는 많은 선택과 감정을 지나갑니다. 보이지 않는 자리까지 살피시는 하나님께 자녀의 오늘을 맡깁니다.",
        "prayer": "하나님, 오늘 제 자녀의 하루를 지켜 주소서. 가는 곳마다 안전을 더하시고, 만나는 사람들과의 관계 속에 지혜와 평안을 허락하소서. 기쁜 순간에는 감사할 줄 알게 하시고, 어려운 순간에는 혼자 감당하지 않고 도움을 구할 용기를 주소서. 하루를 마칠 때 주님의 돌보심을 기억하며 편안히 쉬게 하소서.",
        "prompt": "자녀의 오늘 가운데 특별히 염려되거나 감사한 일은 무엇인가요?",
        "practice": "자녀의 일정을 묻기보다, 오늘 가장 기억에 남는 일이 무엇인지 다정히 물어보세요.",
    },
    {
        "number": "DAY 3",
        "topic": "자녀의 관계",
        "title": "자녀의 관계를 위한 기도",
        "reference": "로마서 12:18",
        "scripture": [
            "18 할 수 있거든 너희로서는 모든 사람으로 더불어 평화하라",
        ],
        "meditation": "관계는 기쁨을 주기도 하고 마음에 깊은 상처를 남기기도 합니다. 자녀가 사랑받고 사랑을 나누는 사람으로 자라도록 기도합니다.",
        "prayer": "주님, 제 자녀의 관계를 돌아보아 주소서. 좋은 친구와 선한 어른을 만나게 하시고, 서로를 존중하며 진실하게 말하는 법을 배우게 하소서. 마음이 상한 관계가 있다면 섣불리 판단하지 않도록 지혜를 주시고, 필요한 거리와 화해의 길을 분별하게 하소서. 저 또한 자녀의 이야기를 충분히 듣는 부모가 되게 하소서.",
        "prompt": "자녀의 관계를 생각할 때 떠오르는 사람이나 상황은 무엇인가요?",
        "practice": "자녀의 친구나 관계를 평가하기 전에, 자녀의 마음을 먼저 들어 주세요.",
    },
    {
        "number": "DAY 4",
        "topic": "자녀의 건강",
        "title": "자녀의 건강을 위한 기도",
        "reference": "요한3서 1:2",
        "scripture": [
            "2 사랑하는 자여 네 영혼이 잘 됨같이 네가 범사에 잘 되고 강건하기를 내가 간구하노라",
        ],
        "meditation": "건강은 당연한 것이 아니라 매일 감사로 돌보아야 할 선물입니다. 몸과 마음이 모두 지치지 않도록 자녀를 위해 기도합니다.",
        "prayer": "돌보시는 하나님, 제 자녀의 몸과 마음을 살펴 주소서. 필요한 잠과 쉼을 누리게 하시고, 불안과 피로가 쌓일 때 혼자 숨기지 않게 하소서. 건강을 소홀히 여기지 않도록 절제하는 마음을 주시고, 도움이 필요할 때 적절한 도움을 받을 수 있도록 인도하소서. 저도 염려만 쌓기보다 사랑으로 돌보고 지혜롭게 살피게 하소서.",
        "prompt": "자녀의 몸과 마음을 위해 지금 가장 기도하고 싶은 것은 무엇인가요?",
        "practice": "오늘 가족과 함께 물 한 잔을 마시고, 서로의 컨디션을 한마디씩 나누어 보세요.",
    },
    {
        "number": "DAY 5",
        "topic": "자녀의 진로",
        "title": "자녀의 진로를 위한 기도",
        "reference": "잠언 3:5-6",
        "scripture": [
            "5 너는 마음을 다하여 여호와를 의뢰하고 네 명철을 의지하지 말라",
            "6 너는 범사에 그를 인정하라 그리하면 네 길을 지도하시리라",
        ],
        "meditation": "진로는 빠르게 답을 찾아야 하는 경쟁이 아니라, 자신에게 맡겨진 길을 발견해 가는 과정입니다. 자녀가 비교보다 성실함으로 한 걸음씩 걸어가도록 기도합니다.",
        "prayer": "인도하시는 하나님, 제 자녀의 진로와 앞날을 주님께 맡깁니다. 잘하는 일과 기뻐하는 일을 알아가게 하시고, 현실의 어려움 앞에서도 낙심하지 않도록 붙들어 주소서. 다른 사람의 속도와 성취를 기준으로 자신을 판단하지 않게 하시며, 필요한 배움과 만남의 기회를 허락하소서. 저도 조급한 기대를 내려놓고 자녀의 과정을 믿음으로 응원하게 하소서.",
        "prompt": "자녀의 앞날을 생각할 때 내려놓고 싶은 염려는 무엇인가요?",
        "practice": "자녀의 성과보다 노력과 성실함을 구체적으로 칭찬해 보세요.",
    },
    {
        "number": "DAY 6",
        "topic": "가정의 화목",
        "title": "가정의 화목을 위한 기도",
        "reference": "시편 133:1-3",
        "scripture": [
            "1 형제가 연합하여 동거함이 어찌 그리 선하고 아름다운고",
            "2 머리에 있는 보배로운 기름이 수염 곧 아론의 수염에 흘러서 그 옷깃까지 내림 같고",
            "3 헐몬의 이슬이 시온의 산들에 내림 같도다 거기서 여호와께서 복을 명하셨나니 곧 영생이로다",
        ],
        "meditation": "화목한 가정은 갈등이 전혀 없는 곳이 아니라, 서로를 다시 이해하고 사랑하기 위해 애쓰는 곳입니다. 우리 집에 평화를 이루는 마음을 구합니다.",
        "prayer": "평화의 하나님, 우리 가정에 주님의 평안을 더해 주소서. 각자의 피곤함과 생각의 차이로 상처 주는 말을 하지 않게 하시고, 서로의 마음을 헤아릴 여유를 주소서. 작은 불편도 쌓아 두지 않고 지혜롭게 나눌 수 있게 하시며, 가족 모두가 집에서 안전하고 사랑받는다고 느끼게 하소서. 오늘 제 말과 표정이 화목의 씨앗이 되게 하소서.",
        "prompt": "우리 가정에 더 필요하다고 느끼는 평화는 어떤 모습인가요?",
        "practice": "가족 한 사람에게 먼저 고맙거나 미안했던 마음을 표현해 보세요.",
    },
    {
        "number": "DAY 7",
        "topic": "가정의 용서",
        "title": "용서를 위한 기도",
        "reference": "에베소서 4:31-32",
        "scripture": [
            "31 너희는 모든 악독과 노함과 분냄과 떠드는 것과 훼방하는 것을 모든 악의와 함께 버리고",
            "32 서로 인자하게 하며 불쌍히 여기며 서로 용서하기를 하나님이 그리스도 안에서 너희를 용서하심과 같이 하라",
        ],
        "meditation": "용서는 상처를 없던 일로 만드는 것이 아니라, 그 상처에 계속 묶이지 않기 위해 하나님께 마음을 드리는 일입니다. 용서가 어려운 마음까지도 정직하게 내어놓습니다.",
        "prayer": "자비로우신 하나님, 제 마음에 남아 있는 서운함과 상처를 아시는 주님께 나아갑니다. 아직 용서하기 어려운 마음을 숨기지 않게 하시고, 제 감정을 주님 앞에 솔직히 내려놓게 하소서. 누군가를 정죄하는 마음에서 조금씩 자유롭게 하시며, 필요하다면 건강한 경계를 세울 지혜도 주소서. 저 또한 가족에게 상처를 주었다면 겸손히 사과할 용기를 주소서.",
        "prompt": "오늘 하나님께 맡기고 싶은 상처나 서운함은 무엇인가요?",
        "practice": "마음에 남아 있던 한 가지 감정을 글로 적고, 기도로 하나님께 맡겨 보세요.",
    },
    {
        "number": "DAY 8",
        "topic": "가정의 쉼",
        "title": "쉼을 위한 기도",
        "reference": "마태복음 11:28-30",
        "scripture": [
            "28 수고하고 무거운 짐진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라",
            "29 나는 마음이 온유하고 겸손하니 나의 멍에를 메고 내게 배우라 그러면 너희 마음이 쉼을 얻으리니",
            "30 이는 내 멍에는 쉽고 내 짐은 가벼움이라 하시니라",
        ],
        "meditation": "쉬는 일은 멈추는 것만이 아니라, 하나님 안에서 다시 숨을 고르는 일입니다. 지친 몸과 마음에 평안한 쉼을 구합니다.",
        "prayer": "쉼을 주시는 하나님, 바쁘고 무거운 마음을 주님 앞에 내려놓습니다. 해야 할 일과 걱정에 눌려 제 마음을 돌보지 못했던 시간을 불쌍히 여겨 주소서. 오늘 필요한 만큼 멈추고 쉬게 하시며, 가족도 서로의 피곤함을 이해하게 하소서. 제 안에 조용한 평안을 주시고, 내일을 맞을 새 힘을 허락하소서.",
        "prompt": "지금 내게 가장 필요한 쉼은 무엇인가요?",
        "practice": "오늘 10분 동안 휴대폰을 내려놓고 조용히 숨을 고르며 기도해 보세요.",
    },
    {
        "number": "DAY 9",
        "topic": "부모의 마음",
        "title": "부모를 위한 기도",
        "reference": "에베소서 6:4",
        "scripture": [
            "4 또 아비들아 너희 자녀를 노엽게 하지 말고 오직 주의 교양과 훈계로 양육하라",
        ],
        "meditation": "부모의 마음에는 사랑과 염려, 책임과 미안함이 함께 머뭅니다. 하나님께서 부모 된 우리의 마음을 먼저 위로하시고 붙들어 주십니다.",
        "prayer": "하나님, 부모인 저를 불쌍히 여기시고 지혜롭게 이끌어 주소서. 부족한 말과 행동으로 가족에게 상처를 주었을 때 겸손히 돌아보게 하시고, 완벽해야 한다는 부담에서 벗어나게 하소서. 자녀를 사랑하되 지나치게 붙들지 않게 하시며, 제가 먼저 믿음과 감사의 본을 보이게 하소서. 제 마음에도 위로와 평안을 더해 주소서.",
        "prompt": "부모로서 나 자신에게 가장 들려주고 싶은 따뜻한 말은 무엇인가요?",
        "practice": "오늘 자신에게 ‘나는 혼자가 아니며, 하나님께 도움을 구할 수 있다’라고 조용히 말해 보세요.",
    },
    {
        "number": "DAY 10",
        "topic": "가정예배",
        "title": "가정예배를 위한 기도",
        "reference": "여호수아 24:15",
        "scripture": [
            "15 만일 여호와를 섬기는 것이 너희에게 좋지 않게 보이거든 너희 열조가 강 저편에서 섬기던 신이든지 혹 너희의 거하는 땅 아모리 사람의 신이든지 너희 섬길 자를 오늘날 택하라 오직 나와 내 집은 여호와를 섬기겠노라",
        ],
        "meditation": "가정예배는 완벽하게 준비된 시간이 아니라, 가족이 함께 하나님께 마음을 향하는 작은 시작입니다. 짧더라도 꾸준히 주님을 기억하는 가정이 되기를 바랍니다.",
        "prayer": "하나님, 우리 가정이 함께 주님을 바라보는 집이 되게 하소서. 형식과 부담에 매이지 않고, 각자의 자리에서 감사와 기도를 나눌 수 있게 하소서. 말씀을 읽고 기도하는 시간이 가족에게 무거운 의무가 아니라 위로와 소망의 시간이 되게 하소서. 바쁜 날에도 잠시 멈추어 주님의 은혜를 기억하게 하소서.",
        "prompt": "우리 가정이 함께 기도할 수 있는 가장 작은 시작은 무엇일까요?",
        "practice": "가족과 3분만 함께 앉아 감사 제목 하나와 기도 제목 하나를 나누어 보세요.",
    },
    {
        "number": "DAY 11",
        "topic": "걱정",
        "title": "걱정을 내려놓는 기도",
        "reference": "빌립보서 4:6-7",
        "scripture": [
            "6 아무 것도 염려하지 말고 오직 모든 일에 기도와 간구로, 너희 구할 것을 감사함으로 하나님께 아뢰라",
            "7 그리하면 모든 지각에 뛰어난 하나님의 평강이 그리스도 예수 안에서 너희 마음과 생각을 지키시리라",
        ],
        "meditation": "걱정은 사랑하는 마음에서 시작되지만, 지나치면 오늘의 평안까지 빼앗아 갑니다. 해결되지 않은 일도 하나님께 맡기며 오늘을 살아갑니다.",
        "prayer": "하나님, 제 마음을 무겁게 하는 모든 걱정을 주님께 올려드립니다. 아직 보이지 않는 답 때문에 두려워하지 않게 하시고, 오늘 제가 할 수 있는 일과 맡겨야 할 일을 분별하게 하소서. 가족의 앞날과 생활의 필요를 주님께 의지하게 하시며, 불안한 생각이 밀려올 때마다 주님의 선하심을 기억하게 하소서. 제 마음에 평안을 더해 주소서.",
        "prompt": "오늘 내가 붙들고 있는 걱정은 무엇이며, 그중 하나님께 맡길 부분은 무엇인가요?",
        "practice": "걱정을 한 문장으로 적은 뒤, 그 아래에 ‘하나님께 맡깁니다’라고 써 보세요.",
    },
    {
        "number": "DAY 12",
        "topic": "위로",
        "title": "위로를 구하는 기도",
        "reference": "이사야 41:10",
        "scripture": [
            "10 두려워 말라 내가 너와 함께 함이니라 놀라지 말라 나는 네 하나님이 됨이니라 내가 너를 굳세게 하리라 참으로 너를 도와 주리라 참으로 나의 의로운 오른손으로 너를 붙들리라",
        ],
        "meditation": "마음이 지친 날에는 빠른 답보다 곁을 지켜 주는 위로가 필요합니다. 하나님은 우리의 연약함을 외면하지 않으시며, 서로를 위로하는 길로 부르십니다.",
        "prayer": "위로의 하나님, 지치고 외로운 마음을 주님께 올려드립니다. 말로 다 표현하지 못한 슬픔과 답답함까지 알아주시고, 제 마음에 필요한 위로를 허락하소서. 힘든 시간을 지나고 있는 가족에게도 따뜻한 사람과 적절한 도움을 보내 주소서. 저 또한 누군가의 아픔을 가볍게 여기지 않고, 함께 울고 곁을 지킬 줄 아는 사람이 되게 하소서.",
        "prompt": "지금 내 마음에 가장 필요한 위로는 무엇인가요?",
        "practice": "힘든 시간을 보내는 사람 한 명에게 짧은 안부를 전해 보세요.",
    },
    {
        "number": "DAY 13",
        "topic": "감사",
        "title": "감사를 배우는 기도",
        "reference": "데살로니가전서 5:16-18",
        "scripture": [
            "16 항상 기뻐하라",
            "17 쉬지 말고 기도하라",
            "18 범사에 감사하라 이는 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라",
        ],
        "meditation": "감사는 문제가 없어서 드리는 말이 아니라, 삶 속에 이미 주어진 은혜를 발견하는 눈입니다. 작은 선물들을 기억하며 하나님께 마음을 돌립니다.",
        "prayer": "은혜의 하나님, 오늘 제게 주신 것들을 돌아보며 감사드립니다. 당연하게 여겼던 가족의 곁, 하루의 필요, 잠시의 평안까지도 주님의 선물임을 기억하게 하소서. 부족한 것만 바라보며 불평하기보다, 받은 사랑을 나누는 마음을 주소서. 감사가 제 말과 표정, 가정의 분위기 속에 자연스럽게 흐르게 하소서.",
        "prompt": "오늘 감사할 수 있는 세 가지는 무엇인가요?",
        "practice": "가족 중 한 사람에게 구체적인 이유를 들어 감사하다고 말해 보세요.",
    },
    {
        "number": "DAY 14",
        "topic": "하나님께 맡김",
        "title": "하나님께 맡기는 기도",
        "reference": "시편 37:5-6",
        "scripture": [
            "5 너의 길을 여호와께 맡기라 저를 의지하면 저가 이루시고",
            "6 네 의를 빛같이 나타내시며 네 공의를 정오의 빛같이 하시리로다",
        ],
        "meditation": "모든 일을 다 알 수 없고 모든 길을 미리 준비할 수도 없지만, 우리는 사랑의 하나님께 삶을 맡길 수 있습니다. 14일의 기도를 마치며 우리 가정의 다음 걸음을 주님께 올려드립니다.",
        "prayer": "신실하신 하나님, 저와 우리 가정의 앞날을 주님께 맡깁니다. 기도한 제목들 가운데 아직 답을 기다리는 일도 있고, 여전히 마음이 무거운 부분도 있습니다. 그 모든 시간을 주님께서 함께 지나 주심을 믿고, 오늘 제게 주어진 자리에서 사랑과 믿음으로 살아가게 하소서. 우리 가정의 걸음을 인도하시고, 어떤 날에도 주님의 은혜를 기억하게 하소서.",
        "prompt": "14일의 기도 여정을 마치며 하나님께 가장 깊이 맡기고 싶은 것은 무엇인가요?",
        "practice": "앞으로 한 달 동안 계속 기도하고 싶은 한 가지를 정해 눈에 보이는 곳에 적어 두세요.",
    },
]


def register_fonts():
    font_path = Path("C:/Windows/Fonts/malgunbd.ttf")
    if not font_path.exists():
        raise FileNotFoundError(f"Required font not found: {font_path}")
    pdfmetrics.registerFont(TTFont(BOLD, str(font_path)))


class ReadabilityCanvas(canvas.Canvas):
    """Applies the settled large-print typography treatment to all text."""

    def setFont(self, psfontname, size, leading=None):
        adjusted_leading = leading + TYPE_SCALE if leading is not None else None
        return super().setFont(psfontname, size + TYPE_SCALE, adjusted_leading)

    def _adjusted_text_width(self, text):
        base_width = pdfmetrics.stringWidth(text, self._fontname, self._fontsize)
        tracking = CHAR_SPACE * max(len(text) - 1, 0)
        return (base_width + tracking) * HORIZONTAL_SCALE / 100

    def _draw_adjusted_text(self, x, y, text):
        text_object = self.beginText()
        text_object.setTextOrigin(x, y)
        text_object.setFont(self._fontname, self._fontsize)
        text_object.setCharSpace(CHAR_SPACE)
        text_object.setHorizScale(HORIZONTAL_SCALE)
        text_object.textOut(text)
        self.drawText(text_object)

    def drawString(self, x, y, text, *args, **kwargs):
        self._draw_adjusted_text(x, y, text)

    def drawCentredString(self, x, y, text, *args, **kwargs):
        self._draw_adjusted_text(x - self._adjusted_text_width(text) / 2, y, text)

    def drawRightString(self, x, y, text, *args, **kwargs):
        self._draw_adjusted_text(x - self._adjusted_text_width(text), y, text)


def text_width(text, font, size):
    actual_size = size + TYPE_SCALE
    glyphs = pdfmetrics.stringWidth(text, font, actual_size)
    tracking = CHAR_SPACE * max(len(text) - 1, 0)
    return (glyphs + tracking) * HORIZONTAL_SCALE / 100


def wrap(text, font, size, width):
    lines, current = [], ""
    for word in text.split(" "):
        candidate = word if not current else f"{current} {word}"
        if text_width(candidate, font, size) <= width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        while text_width(current, font, size) > width:
            cut = len(current) - 1
            while cut and text_width(current[:cut], font, size) > width:
                cut -= 1
            lines.append(current[:cut])
            current = current[cut:]
    if current:
        lines.append(current)
    return lines


def wrapped_lines(texts, font, size, width):
    return [line for text in texts for line in wrap(text, font, size, width)]


def write_wrapped(c, text, x, y, width, font=SANS, size=11, leading=19, color=NAVY):
    c.setFillColor(color)
    c.setFont(font, size)
    for line in wrap(text, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def page_background(c):
    c.setFillColor(IVORY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(DEEP_NAVY)
    c.rect(0, 0, 12, PAGE_H, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(12, PAGE_H - 8, PAGE_W - 12, 8, fill=1, stroke=0)
    c.setFillColor(HexColor("#F6F1E7"))
    c.rect(12, 0, PAGE_W - 12, 18, fill=1, stroke=0)


def footer(c, page_no):
    c.setStrokeColor(HexColor("#CFC2AB"))
    c.setLineWidth(0.7)
    c.line(MARGIN_X, 42, PAGE_W - MARGIN_X, 42)
    c.setFillColor(NAVY)
    c.setFont(SANS, 9.5)
    c.drawString(MARGIN_X, 25, "기도의샘물  |  가정을 품는 14일 기도")
    c.drawRightString(PAGE_W - MARGIN_X, 25, f"{page_no:02d} / {TOTAL_PAGES:02d}")


def cover(c):
    c.setFillColor(DEEP_NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(0, PAGE_H - 10, PAGE_W, 10, fill=1, stroke=0)
    c.setStrokeColor(HexColor("#263754"))
    c.setLineWidth(1.1)
    c.circle(PAGE_W - 65, PAGE_H - 105, 132, fill=0, stroke=1)
    c.circle(PAGE_W - 65, PAGE_H - 105, 94, fill=0, stroke=1)
    c.setStrokeColor(HexColor("#D9BB7C"))
    c.setLineWidth(0.8)
    c.roundRect(52, 75, PAGE_W - 104, PAGE_H - 150, 18, fill=0, stroke=1)
    c.setFillColor(HexColor("#E7C987"))
    c.setFont(SANS, 12.5)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 175, "기도의샘물  ·  PAID PRAYER JOURNAL")
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.1)
    c.line(PAGE_W / 2 - 48, PAGE_H - 212, PAGE_W / 2 + 48, PAGE_H - 212)
    c.setFillColor(WHITE)
    c.setFont(SERIF, 39)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 312, "가정을 품는")
    c.setFont(SERIF, 47)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 373, "14일 기도")
    c.setFillColor(HexColor("#DDE3EC"))
    c.setFont(SANS, 14.5)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 431, "개역한글 본문과 함께하는 자녀 · 가정 · 마음의 기도")
    c.setFillColor(HexColor("#E7C987"))
    c.setFont(SANS, 12)
    c.drawCentredString(PAGE_W / 2, 136, "말씀을 읽고, 기도하고, 마음을 기록하는 14일")
    c.setFont(SANS, 10.5)
    c.drawCentredString(PAGE_W / 2, 108, "개인 · 가정용 PDF  |  판매가 4,900원")
    c.setFillColor(HexColor("#E7C987"))
    c.setFont(SANS, 9.5)
    c.drawRightString(PAGE_W - 52, 32, f"01 / {TOTAL_PAGES:02d}")
    c.showPage()


def material_info_page(c, page_no):
    page_background(c)
    c.setFillColor(GOLD)
    c.setFont(SANS, 12)
    c.drawString(MARGIN_X, PAGE_H - 79, "자료 정보")
    c.setFillColor(NAVY)
    c.setFont(SERIF, 29)
    c.drawString(MARGIN_X, PAGE_H - 121, "이 자료를 소개합니다")

    blocks = [
        ("자료 제목", MATERIAL_INFO["title"], NAVY, 15),
        ("짧은 요약", MATERIAL_INFO["summary"], NAVY, 13.5),
        ("키워드", " · ".join(MATERIAL_INFO["keywords"]), DEEP_NAVY, 14),
        ("상세 설명", MATERIAL_INFO["description"], NAVY, 13),
    ]
    y = PAGE_H - 180
    for label, body, color, size in blocks:
        c.setFillColor(BEIGE if label != "키워드" else SAGE)
        height = 74 if label in ("자료 제목", "키워드") else 96
        c.roundRect(MARGIN_X, y - height, PAGE_W - MARGIN_X * 2, height, 12, fill=1, stroke=0)
        c.setFillColor(GOLD)
        c.setFont(SANS, 10.5)
        c.drawString(MARGIN_X + 18, y - 24, label)
        write_wrapped(c, body, MARGIN_X + 18, y - 50, PAGE_W - MARGIN_X * 2 - 36, size=size, leading=22, color=color)
        y -= height + 16

    c.setFillColor(DEEP_NAVY)
    c.roundRect(MARGIN_X, 102, PAGE_W - MARGIN_X * 2, 54, 12, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(SANS, 13)
    c.drawCentredString(PAGE_W / 2, 130, f"{MATERIAL_INFO['price']}  |  {MATERIAL_INFO['use_scope']}")
    footer(c, page_no)
    c.showPage()


def guide(c, page_no):
    page_background(c)
    c.setFillColor(GOLD)
    c.setFont(SANS, 12)
    c.drawString(MARGIN_X, PAGE_H - 79, "사용 안내")
    c.setFillColor(NAVY)
    c.setFont(SERIF, 29)
    c.drawString(MARGIN_X, PAGE_H - 121, "말씀을 읽고, 마음을 적는 시간")
    y = PAGE_H - 178
    intro = "이 자료는 가족을 위해 기도하고 싶은 날, 짧게 멈추어 마음을 정돈하도록 돕는 14일 여정입니다. 하루 한 쌍의 페이지를 천천히 읽고, 기도와 기록으로 오늘의 마음을 하나님께 올려드려 보세요."
    y = write_wrapped(c, intro, MARGIN_X, y, PAGE_W - MARGIN_X * 2, size=14.5, leading=26, color=NAVY)
    steps = [
        ("1", "개역한글 본문을 천천히 읽습니다", "각 일차의 본문은 장절과 함께 수록했습니다. 절 번호와 문장을 따라 천천히 읽어 보세요."),
        ("2", "묵상과 기도문을 내 마음으로 읽습니다", "기도문을 그대로 읽거나, 지금의 상황에 맞는 말로 고쳐 기도해도 좋습니다."),
        ("3", "오늘의 기록과 작은 실천을 남깁니다", "응답을 재촉하지 않고, 오늘 할 수 있는 작은 사랑의 행동을 한 가지 적어 보세요."),
    ]
    y -= 34
    for number, title, body in steps:
        c.setFillColor(GOLD)
        c.circle(MARGIN_X + 18, y + 4, 18, fill=1, stroke=0)
        c.setFillColor(DEEP_NAVY)
        c.setFont(SANS, 12)
        c.drawCentredString(MARGIN_X + 18, y, number)
        c.setFillColor(NAVY)
        c.setFont(SANS, 15)
        c.drawString(MARGIN_X + 54, y, title)
        y = write_wrapped(c, body, MARGIN_X + 54, y - 28, PAGE_W - MARGIN_X * 2 - 54, size=13, leading=22, color=MUTED) - 32
    c.setFillColor(BEIGE)
    c.roundRect(MARGIN_X, 106, PAGE_W - MARGIN_X * 2, 88, 12, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont(SERIF, 16)
    c.drawString(MARGIN_X + 20, 162, "14일을 위한 작은 권유")
    write_wrapped(c, "잘 해내야 한다는 부담보다, 하나님 앞에 마음을 내려놓는 시간을 소중히 여겨 주세요.", MARGIN_X + 20, 134, PAGE_W - MARGIN_X * 2 - 40, size=13, leading=22, color=NAVY)
    footer(c, page_no)
    c.showPage()


def verse_lines(day, width):
    return wrapped_lines(day["scripture"], SANS, 13, width)


def reading_page(c, day, page_no):
    page_background(c)
    c.setFillColor(GOLD)
    c.setFont(SANS, 12)
    c.drawString(MARGIN_X, PAGE_H - 79, f"{day['number']}  ·  {day['topic']}")
    c.setFillColor(NAVY)
    c.setFont(SERIF, 28)
    c.drawString(MARGIN_X, PAGE_H - 116, day["title"])
    c.setFillColor(SAGE)
    c.roundRect(MARGIN_X, PAGE_H - 165, 160, 32, 12, fill=1, stroke=0)
    c.setFillColor(DEEP_NAVY)
    c.setFont(SANS, 11.5)
    c.drawCentredString(MARGIN_X + 80, PAGE_H - 153, day["reference"])

    scripture_width = PAGE_W - MARGIN_X * 2 - 36
    scripture_lines = verse_lines(day, scripture_width)
    scripture_height = 55 + len(scripture_lines) * 22
    scripture_top = PAGE_H - 190
    c.setFillColor(BEIGE)
    c.roundRect(MARGIN_X, scripture_top - scripture_height, PAGE_W - MARGIN_X * 2, scripture_height, 12, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont(SANS, 10.5)
    c.drawString(MARGIN_X + 18, scripture_top - 24, "오늘의 말씀  ·  성경전서 개역한글판")
    c.setFillColor(DEEP_NAVY)
    c.setFont(SANS, 13)
    y = scripture_top - 50
    for line in scripture_lines:
        c.drawString(MARGIN_X + 18, y, line)
        y -= 22

    y = scripture_top - scripture_height - 27
    c.setFillColor(NAVY)
    c.setFont(SANS, 11.5)
    c.drawString(MARGIN_X, y, "짧은 묵상")
    y = write_wrapped(c, day["meditation"], MARGIN_X, y - 26, PAGE_W - MARGIN_X * 2, size=13.4, leading=22, color=NAVY) - 14
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.8)
    c.line(MARGIN_X, y, MARGIN_X + 46, y)
    y -= 28
    c.setFillColor(NAVY)
    c.setFont(SANS, 11.5)
    c.drawString(MARGIN_X, y, "직접 읽는 기도문")
    y -= 28
    c.setFillColor(GOLD)
    c.roundRect(MARGIN_X, y - 172, 5, 168, 2, fill=1, stroke=0)
    write_wrapped(c, day["prayer"], MARGIN_X + 21, y, PAGE_W - MARGIN_X * 2 - 21, font=SERIF, size=14.5, leading=25, color=DEEP_NAVY)
    footer(c, page_no)
    c.showPage()


def journal_page(c, day, page_no):
    page_background(c)
    c.setFillColor(GOLD)
    c.setFont(SANS, 12)
    c.drawString(MARGIN_X, PAGE_H - 79, f"{day['number']}  ·  기록과 실천")
    c.setFillColor(NAVY)
    c.setFont(SERIF, 29)
    c.drawString(MARGIN_X, PAGE_H - 122, "오늘의 마음을 기록합니다")
    c.setFillColor(BEIGE)
    c.roundRect(MARGIN_X, PAGE_H - 234, PAGE_W - MARGIN_X * 2, 72, 12, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont(SANS, 12)
    c.drawString(MARGIN_X + 18, PAGE_H - 192, "오늘의 기록")
    write_wrapped(c, day["prompt"], MARGIN_X + 18, PAGE_H - 216, PAGE_W - MARGIN_X * 2 - 36, size=14, leading=23, color=NAVY)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    y = PAGE_H - 280
    for _ in range(10):
        c.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
        y -= 28
    c.setFillColor(SAGE)
    c.roundRect(MARGIN_X, 144, PAGE_W - MARGIN_X * 2, 78, 12, fill=1, stroke=0)
    c.setFillColor(DEEP_NAVY)
    c.setFont(SANS, 12)
    c.drawString(MARGIN_X + 18, 194, "오늘의 작은 실천")
    write_wrapped(c, day["practice"], MARGIN_X + 18, 168, PAGE_W - MARGIN_X * 2 - 36, size=14, leading=23, color=DEEP_NAVY)
    footer(c, page_no)
    c.showPage()


def reflection_page(c, page_no):
    page_background(c)
    c.setFillColor(GOLD)
    c.setFont(SANS, 12)
    c.drawString(MARGIN_X, PAGE_H - 79, "여정 회고")
    c.setFillColor(NAVY)
    c.setFont(SERIF, 30)
    c.drawString(MARGIN_X, PAGE_H - 121, "14일의 여정을 돌아봅니다")
    c.setFillColor(NAVY)
    c.setFont(SANS, 13.5)
    c.drawString(MARGIN_X, PAGE_H - 159, "이미 받은 은혜와 계속 하나님께 맡기고 싶은 마음을 천천히 적어 보세요.")
    blocks = [
        ("이 여정에서 감사한 일", "작은 일도 괜찮습니다. 내 마음에 남은 은혜를 적어 보세요."),
        ("가족에게 새롭게 발견한 마음", "고마움, 이해하고 싶은 마음, 함께 나누고 싶은 바람을 적어 보세요."),
        ("앞으로도 계속 기도할 제목", "답을 서두르지 않고, 하나님께 맡기고 싶은 일을 적어 보세요."),
    ]
    y = PAGE_H - 220
    for title, hint in blocks:
        c.setFillColor(BEIGE)
        c.roundRect(MARGIN_X, y - 27, PAGE_W - MARGIN_X * 2, 34, 10, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont(SANS, 13)
        c.drawString(MARGIN_X + 14, y - 15, title)
        c.setFillColor(MUTED)
        c.setFont(SANS, 11.5)
        c.drawString(MARGIN_X, y - 52, hint)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.7)
        for offset in range(0, 70, 24):
            c.line(MARGIN_X, y - 80 - offset, PAGE_W - MARGIN_X, y - 80 - offset)
        y -= 175
    footer(c, page_no)
    c.showPage()


def rights_page(c, page_no):
    page_background(c)
    c.setFillColor(GOLD)
    c.setFont(SANS, 12)
    c.drawString(MARGIN_X, PAGE_H - 79, "이용 안내")
    c.setFillColor(NAVY)
    c.setFont(SERIF, 30)
    c.drawString(MARGIN_X, PAGE_H - 121, "이용 안내")
    sections = [
        ("성경 본문 표기", "이 자료에 수록한 성경 본문은 성경전서 개역한글판 · 대한성서공회 · 1961입니다. 장절과 본문 표기는 개역한글 원문을 기준으로 하며, 임의로 현대화하거나 다른 번역본과 혼용하지 않았습니다."),
        ("콘텐츠 저작권", "묵상, 기도문, 편집 디자인은 기도의샘물을 위해 새롭게 작성한 창작 콘텐츠입니다. 신앙생활을 돕는 읽기 자료이며, 어떤 결과나 응답을 보장하지 않습니다."),
        ("사용 범위", "구매자 1인 및 동일 가정의 개인적 열람과 인쇄에만 사용할 수 있습니다. 파일의 공유, 재배포, 판매, 편집, 온라인 게시 및 대량 인쇄는 허용하지 않습니다."),
        ("자료 특징", "큰 글씨와 높은 대비, 넉넉한 줄간격과 기록 공간으로 A4 인쇄와 휴대폰 열람을 함께 고려했습니다."),
    ]
    y = PAGE_H - 178
    for heading, body in sections:
        c.setFillColor(NAVY)
        c.setFont(SANS, 14.5)
        c.drawString(MARGIN_X, y, heading)
        y = write_wrapped(c, body, MARGIN_X, y - 29, PAGE_W - MARGIN_X * 2, size=12.4, leading=21, color=NAVY) - 25
    c.setFillColor(DEEP_NAVY)
    c.roundRect(MARGIN_X, 102, PAGE_W - MARGIN_X * 2, 54, 12, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(SERIF, 15)
    c.drawCentredString(PAGE_W / 2, 134, "기도와 말씀으로 쉬어가는 곳")
    c.setFont(SANS, 11)
    c.drawCentredString(PAGE_W / 2, 116, "기도의샘물")
    footer(c, page_no)
    c.showPage()


def build_preview():
    reader = PdfReader(str(PAID_OUTPUT))
    if len(reader.pages) != TOTAL_PAGES:
        raise RuntimeError(f"Expected {TOTAL_PAGES} pages, got {len(reader.pages)}")
    writer = PdfWriter()
    # Public preview: cover, material information, and the complete DAY 1 pair.
    for page_index in (0, 1, 3, 4):
        writer.add_page(reader.pages[page_index])
    writer.add_metadata({
        "/Title": "가정을 품는 14일 기도 미리보기",
        "/Author": "기도의샘물",
        "/Subject": "공개 미리보기: 표지, 자료 정보, DAY 1 읽기·기록",
    })
    with PREVIEW_OUTPUT.open("wb") as output_file:
        writer.write(output_file)


def build():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    register_fonts()
    c = ReadabilityCanvas(str(PAID_OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("가정을 품는 14일 기도")
    c.setAuthor("기도의샘물")
    c.setSubject("개역한글 본문 수록 · 자녀와 가정을 위한 14일 기도")
    c.setKeywords("자녀, 가정, 걱정, 위로, 감사, 결심")

    cover(c)
    material_info_page(c, 2)
    guide(c, 3)
    page_no = 4
    for day in DAYS:
        reading_page(c, day, page_no)
        journal_page(c, day, page_no + 1)
        page_no += 2
    reflection_page(c, 32)
    rights_page(c, 33)
    c.save()
    build_preview()
    print(PAID_OUTPUT)
    print(PREVIEW_OUTPUT)


if __name__ == "__main__":
    build()
