"""Enhance the three existing prayer PDFs without changing their approved daily manuscripts."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
import re

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


OUTPUT_ROOT = Path(r"D:\codex\sinang\prayPDF")
FONT_BOLD = r"C:\Windows\Fonts\malgunbd.ttf"
FONT = "MalgunBold"
PAGE_W, PAGE_H = A4
CREAM = HexColor("#F8F5EC")
NAVY = HexColor("#0C1B36")
INK = HexColor("#14233D")
GOLD = HexColor("#B78A3E")
SAGE = HexColor("#C9D6C6")
MUTED = HexColor("#596477")
WHITE = HexColor("#FFFFFF")


PRODUCTS = [
    {
        "key": "family7",
        "folder": "가정을_품는_7일_기도(샘플)",
        "source": "가정을_품는_7일_(샘플).pdf",
        "output": "가정을_품는_7일_(샘플).pdf",
        "preview": "가정을_품는_7일_기도_미리보기.pdf",
        "upload": "가정을_품는_7일_기도_업로드용_상품정보.md",
        "source_pages": 18,
        "title": "가정을 품는 7일간의 기도",
        "cover_lines": ["가정을 품는", "7일간의 기도"],
        "subtitle": "자녀와 가정, 지친 마음을 말씀 앞에 내려놓는 일주일",
        "summary": "자녀의 믿음과 가정의 평안, 지친 마음을 위해 말씀을 묵상하고 기도하며 기록하는 7일 여정입니다.",
        "description": "가족을 위해 기도하고 싶지만 어떤 말로 시작할지 망설이는 분을 위한 무료 입문 기도 PDF입니다. 매일 성경 장절, 짧은 묵상, 직접 읽는 기도문, 기록과 작은 실천을 차례로 만나며 일주일의 기도 리듬을 세우도록 돕습니다. 개인 묵상과 가정예배, 비영리 소그룹에서 활용할 수 있습니다.",
        "keywords": ["자녀", "가정", "믿음", "쉼", "위로", "감사", "맡김"],
        "topics": ["자녀의 믿음", "자녀의 하루", "가정의 화목", "가정의 쉼", "지친 마음의 위로", "감사", "하나님께 맡기는 기도"],
        "goal": "가족을 향한 마음과 지친 감정을 말씀·기도·기록·작은 실천으로 차분히 돌아보고, 매일 한 가지 실천을 이어가며 일주일의 기도 리듬을 세우도록 돕습니다.",
        "retain_start": 1,
        "retain_end": 16,
        "reflection_index": 16,
        "total": 21,
    },
    {
        "key": "family14",
        "folder": "가정을_품는_14일_기도_유료본",
        "source": "가정을_품는_14일_기도_유료본.pdf",
        "output": "가정을_품는_14일_기도_유료본.pdf",
        "preview": "가정을_품는_14일_기도_미리보기.pdf",
        "upload": "가정을_품는_14일_기도_업로드용_상품정보.md",
        "source_pages": 33,
        "title": "가정을 품는 14일 기도",
        "cover_lines": ["가정을 품는", "14일 기도"],
        "subtitle": "말씀을 읽고 · 기도하고 · 기록하는 가족 기도 여정",
        "summary": "자녀와 가정, 오늘의 마음을 위해 개역한글 말씀을 읽고 기도하며 기록하는 14일 여정입니다.",
        "description": "가족을 위해 기도하고 싶지만 어떤 말로 시작할지 망설이는 분을 위한 개인·가정용 기도 PDF입니다. 매일 말씀, 묵상, 직접 읽는 기도문, 기록과 작은 실천을 같은 순서로 만나며 막연한 걱정을 구체적인 기도로 바꾸도록 돕습니다. 개인 묵상과 가정예배, 비영리 소그룹에서 활용할 수 있습니다.",
        "keywords": ["자녀", "관계", "건강", "진로", "가정", "불안", "위로", "감사"],
        "topics": ["자녀의 믿음", "자녀의 관계", "자녀의 건강", "자녀의 진로", "자녀의 안전", "가정의 대화", "가정의 용서", "가정의 쉼", "부모의 지혜", "가정예배", "불안", "위로", "감사", "결심"],
        "goal": "가족을 향한 막연한 걱정을 말씀·기도·기록·작은 실천으로 구체화하고, 자녀와 가정의 여러 상황을 매일 한 가지씩 하나님께 올려드리는 기도 습관을 세우도록 돕습니다.",
        "retain_start": 2,
        "retain_end": 31,
        "reflection_index": 31,
        "total": 35,
    },
    {
        "key": "work7",
        "folder": "일터와_생업을_위한_7일_기도_유료본",
        "source": "일터와_생업을_위한_7일_기도_유료본.pdf",
        "output": "일터와_생업을_위한_7일_기도_유료본.pdf",
        "preview": "일터와_생업을_위한_7일_기도_미리보기.pdf",
        "upload": "일터와_생업을_위한_7일_기도_업로드용_상품정보.md",
        "source_pages": 19,
        "title": "일터와 생업을 위한 7일 기도",
        "cover_lines": ["일터와 생업을 위한", "7일 기도"],
        "subtitle": "일의 결과보다 오늘의 태도와 선택을 말씀 앞에 세우는 일주일",
        "summary": "일의 자리에서 성실과 정직, 지혜와 회복을 구하며 개역한글 말씀을 읽고 기도하는 7일 여정입니다.",
        "description": "매일의 일과 생업을 믿음으로 감당하고 싶지만 마음이 흔들리는 분을 위한 기도 PDF입니다. 성실, 정직한 선택, 시간 사용, 실패 뒤의 회복, 공의, 수고의 열매, 일의 기쁨을 서로 겹치지 않는 말씀과 기도로 만납니다. 출근 전 개인 묵상과 직장 신우회, 비영리 소그룹에서 활용할 수 있습니다.",
        "keywords": ["일터", "생업", "성실", "정직", "시간", "회복", "공의", "수고"],
        "topics": ["맡겨진 일의 성실", "정직한 선택", "시간의 청지기", "실수 뒤의 회복", "공의를 지키는 용기", "수고의 열매", "일에서 누리는 기쁨"],
        "goal": "일의 결과와 평가에만 끌려가지 않고 성실·정직·시간 사용·회복·공의의 태도를 말씀 앞에서 점검하며, 매일 실행 가능한 한 가지 행동으로 일과 신앙을 연결하도록 돕습니다.",
        "retain_start": 2,
        "retain_end": 17,
        "reflection_index": 17,
        "total": 21,
    },
]


def register_font() -> None:
    if FONT not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT, FONT_BOLD))


def wrap(text: str, size: float, width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.splitlines() or [""]:
        words = paragraph.split(" ")
        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if pdfmetrics.stringWidth(candidate, FONT, size) <= width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        if not paragraph:
            lines.append("")
    return lines


def draw_wrapped(c: canvas.Canvas, text: str, x: float, y: float, width: float, size: float = 13, leading: float = 23, color=INK, max_lines: int | None = None) -> float:
    c.setFont(FONT, size)
    c.setFillColor(color)
    lines = wrap(text, size, width)
    if max_lines:
        lines = lines[:max_lines]
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def new_page(drawer) -> object:
    stream = BytesIO()
    c = canvas.Canvas(stream, pagesize=A4, pageCompression=1)
    drawer(c)
    c.save()
    stream.seek(0)
    return PdfReader(stream).pages[0]


def base_page(c: canvas.Canvas, section: str, title: str) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, 0, 12, PAGE_H, fill=1, stroke=0)
    c.rect(12, PAGE_H - 8, PAGE_W - 12, 8, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont(FONT, 11)
    c.drawString(54, PAGE_H - 70, section)
    c.setFillColor(NAVY)
    c.setFont(FONT, 26)
    c.drawString(54, PAGE_H - 110, title)


def cover_page(product: dict) -> object:
    def draw(c: canvas.Canvas) -> None:
        key = product["key"]
        if key == "family14":
            c.setFillColor(NAVY); c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
            c.setStrokeColor(GOLD); c.setLineWidth(2)
            for inset in (62, 82, 102):
                c.arc(inset, 120, PAGE_W - inset, PAGE_H - 82, 0, 180)
            c.setFillColor(SAGE); c.circle(PAGE_W - 92, PAGE_H - 112, 48, fill=1, stroke=0)
            c.setFillColor(NAVY); c.roundRect(PAGE_W - 118, PAGE_H - 128, 52, 42, 4, fill=1, stroke=0)
        elif key == "family7":
            c.setFillColor(HexColor("#EEF1E8")); c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
            c.setFillColor(SAGE); c.rect(0, 0, PAGE_W * .38, PAGE_H, fill=1, stroke=0)
            c.setStrokeColor(NAVY); c.setLineWidth(3); c.roundRect(72, 116, PAGE_W - 144, PAGE_H - 232, 150, fill=0, stroke=1)
            c.setStrokeColor(GOLD); c.setLineWidth(1.4)
            c.line(110, 178, 110, 520); c.line(110, 360, 192, 438); c.line(110, 430, 64, 492)
            for x, y in ((192,438),(64,492),(110,520)):
                c.circle(x, y, 12, fill=0, stroke=1)
        else:
            c.setFillColor(HexColor("#152128")); c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
            c.setStrokeColor(HexColor("#677A78")); c.setLineWidth(.8)
            for y in range(110, 610, 52): c.line(0, y, PAGE_W, y + 70)
            for x in range(-100, 700, 70): c.line(x, 80, x + 280, 660)
            c.setFillColor(GOLD); c.rect(0, 92, PAGE_W, 10, fill=1, stroke=0)

        text_color = NAVY if key == "family7" else WHITE
        c.setFillColor(GOLD if key != "family7" else NAVY)
        c.setFont(FONT, 11)
        c.drawString(58, PAGE_H - 72, "기도의샘물 · PRAYER JOURNAL")
        c.setFillColor(text_color)
        c.setFont(FONT, 37 if len(product["cover_lines"][0]) < 10 else 29)
        c.drawString(58, PAGE_H - 300, product["cover_lines"][0])
        c.setFont(FONT, 50)
        c.drawString(58, PAGE_H - 366, product["cover_lines"][1])
        c.setFillColor(GOLD if key != "family7" else HexColor("#7E5D28"))
        c.rect(58, PAGE_H - 403, 90, 3, fill=1, stroke=0)
        draw_wrapped(c, product["subtitle"], 58, PAGE_H - 438, PAGE_W - 116, 14, 24, text_color, 3)
        c.setFillColor(text_color)
        c.setFont(FONT, 11)
        c.drawString(58, 58, "큰 글씨 · 말씀 · 기도 · 기록 · 작은 실천")
        c.drawRightString(PAGE_W - 52, 32, f"01 / {product['total']:02d}")
    return new_page(draw)


def metadata_page(product: dict) -> object:
    def draw(c: canvas.Canvas) -> None:
        base_page(c, "자료 정보", "이 기도 자료를 소개합니다")
        cards = [
            ("자료 제목", product["title"], SAGE, 70),
            ("짧은 요약", product["summary"], HexColor("#F1E2BE"), 108),
            ("키워드", " · ".join(product["keywords"]), SAGE, 82),
            ("상세 설명", product["description"], HexColor("#F1E2BE"), 166),
        ]
        y = PAGE_H - 150
        for label, body, fill, height in cards:
            c.setFillColor(fill); c.roundRect(54, y - height, PAGE_W - 108, height - 8, 12, fill=1, stroke=0)
            c.setFillColor(GOLD); c.setFont(FONT, 11); c.drawString(72, y - 28, label)
            draw_wrapped(c, body, 72, y - 54, PAGE_W - 144, 13.5, 23, INK, 6)
            y -= height + 14
    return new_page(draw)


def group_method_page(product: dict) -> object:
    def draw(c: canvas.Canvas) -> None:
        base_page(c, "함께 활용하기", "개인 · 가정 · 소그룹 사용법")
        modes = [
            ("개인 묵상", "10~15분을 정해 말씀과 기도문을 읽고, 오늘의 기록 한 문장과 작은 실천 한 가지를 남깁니다."),
            ("가정예배", "한 사람이 말씀과 묵상을 읽고 각자 한 문장씩 기도합니다. 기록은 강요하지 않고, 함께 실천할 한 가지를 정합니다."),
            ("소그룹", "모임 전에 각자 한 일차를 사용합니다. 기록 중 나누어도 되는 한 문장만 자발적으로 나누고 서로의 비밀을 지킵니다."),
        ]
        y = PAGE_H - 155
        for index, (label, body) in enumerate(modes, 1):
            c.setFillColor(WHITE); c.roundRect(54, y - 126, PAGE_W - 108, 112, 12, fill=1, stroke=0)
            c.setFillColor(GOLD); c.circle(82, y - 43, 16, fill=1, stroke=0)
            c.setFillColor(WHITE); c.setFont(FONT, 12); c.drawCentredString(82, y - 48, str(index))
            c.setFillColor(NAVY); c.setFont(FONT, 17); c.drawString(112, y - 42, label)
            draw_wrapped(c, body, 112, y - 70, PAGE_W - 184, 12.5, 22, MUTED, 3)
            y -= 132
        c.setFillColor(SAGE); c.roundRect(54, 112, PAGE_W - 108, 116, 12, fill=1, stroke=0)
        c.setFillColor(NAVY); c.setFont(FONT, 15); c.drawString(72, 198, "30분 소그룹 흐름")
        draw_wrapped(c, "마음 열기 5분  ·  말씀과 묵상 7분  ·  함께 기도 10분  ·  기록과 실천 5분  ·  마침기도 3분", 72, 168, PAGE_W - 144, 12.5, 22, INK, 3)
    return new_page(draw)


def group_safety_page(product: dict) -> object:
    def draw(c: canvas.Canvas) -> None:
        base_page(c, "함께 활용하기", "안전하게 나누고 인쇄하는 기준")
        blocks = [
            ("비영리 인쇄", "구매 1건에는 교회·기관의 비영리 모임을 위한 인쇄 20부까지 포함됩니다. 20부를 초과하는 경우 웹사이트에서 추가 인쇄 이용권을 확인해 주세요."),
            ("안전한 나눔", "기록 공개를 강요하지 않습니다. 자녀·가족·직장 동료의 실명과 민감한 사정을 온라인에 올리지 않으며, 모임에서 들은 이야기를 밖으로 옮기지 않습니다."),
            ("진행자의 역할", "정답을 제시하기보다 충분히 듣고, 기도 응답이나 치유를 보장하는 표현을 피합니다. 의료·법률·재정 도움이 필요한 상황은 적절한 전문 지원과 연결합니다."),
            ("파일 이용", "PDF 파일 자체를 단체 채팅방, 온라인 저장소, SNS에 공유하거나 재판매·편집·재배포하지 않습니다. 필요한 부수만 직접 인쇄해 사용합니다."),
        ]
        y = PAGE_H - 158
        for idx, (label, body) in enumerate(blocks):
            fill = SAGE if idx % 2 == 0 else HexColor("#F1E2BE")
            c.setFillColor(fill); c.roundRect(54, y - 132, PAGE_W - 108, 118, 12, fill=1, stroke=0)
            c.setFillColor(NAVY); c.setFont(FONT, 16); c.drawString(72, y - 44, label)
            draw_wrapped(c, body, 72, y - 72, PAGE_W - 144, 12.3, 21, INK, 4)
            y -= 136
    return new_page(draw)


def rights_page(product: dict) -> object:
    def draw(c: canvas.Canvas) -> None:
        base_page(c, "이용 안내", "저작권과 이용 범위")
        items = [
            ("성경 본문", "성경전서 개역한글판 · 대한성서공회 · 1961. 수록 장절과 본문은 개역한글 원문을 기준으로 사용했습니다."),
            ("기도문과 편집", "묵상, 기도문, 기록 질문, 편집 디자인은 기도의샘물의 신규 창작물입니다."),
            ("허용 범위", "구매자 개인·가정의 열람과 인쇄, 교회·기관 비영리 모임의 20부 이내 인쇄를 허용합니다."),
            ("허용하지 않는 이용", "파일 공유, 온라인 게시, 재판매, 편집 후 재배포, 상업 수업·상품의 부속 자료 사용은 허용하지 않습니다."),
            ("안내", "이 자료는 기도를 돕는 자료이며 특정한 응답, 치유, 결과를 보장하지 않습니다."),
        ]
        y = PAGE_H - 158
        for label, body in items:
            c.setFillColor(GOLD); c.setFont(FONT, 13); c.drawString(54, y, label)
            y = draw_wrapped(c, body, 54, y - 27, PAGE_W - 108, 12.5, 22, INK, 4) - 26
        c.setFillColor(NAVY); c.roundRect(54, 88, PAGE_W - 108, 72, 12, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont(FONT, 15); c.drawCentredString(PAGE_W / 2, 127, "기도와 말씀으로 쉬어가는 곳")
        c.setFont(FONT, 12); c.drawCentredString(PAGE_W / 2, 108, "기도의샘물")
    return new_page(draw)


def numbered(page, number: int, total: int) -> object:
    if number == 1:
        return page
    overlay = new_page(lambda c: _draw_footer(c, number, total))
    page.merge_page(overlay, over=True)
    return page


def _draw_footer(c: canvas.Canvas, number: int, total: int) -> None:
    c.setFillColor(CREAM); c.rect(0, 0, PAGE_W, 45, fill=1, stroke=0)
    c.setStrokeColor(HexColor("#D8D2C4")); c.setLineWidth(.6); c.line(54, 42, PAGE_W - 54, 42)
    c.setFillColor(MUTED); c.setFont(FONT, 9); c.drawString(54, 24, "기도의샘물")
    c.drawRightString(PAGE_W - 54, 24, f"{number:02d} / {total:02d}")


def build_product(product: dict) -> tuple[Path, Path]:
    folder = OUTPUT_ROOT / product["folder"]
    source_path = folder / product["source"]
    reader = PdfReader(str(source_path))
    final_path = folder / product["output"]
    existing_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if len(reader.pages) == product["total"] and "함께 활용하기" in existing_text:
        preview_writer = PdfWriter()
        for index in (0, 1, 3, 4):
            preview_writer.add_page(reader.pages[index])
        preview_path = folder / product["preview"]
        with preview_path.open("wb") as handle:
            preview_writer.write(handle)
        (folder / product["upload"]).write_text(upload_copy(product), encoding="utf-8", newline="\n")
        return final_path, preview_path
    if len(reader.pages) != product["source_pages"]:
        raise RuntimeError(f"{product['title']}: expected {product['source_pages']} source pages, got {len(reader.pages)}")

    pages = [cover_page(product), metadata_page(product)]
    pages.extend(reader.pages[product["retain_start"]:product["retain_end"]])
    pages.extend([group_method_page(product), group_safety_page(product)])
    pages.append(reader.pages[product["reflection_index"]])
    pages.append(rights_page(product))
    if len(pages) != product["total"]:
        raise RuntimeError(f"{product['title']}: expected {product['total']} pages, got {len(pages)}")

    writer = PdfWriter()
    for number, page in enumerate(pages, 1):
        writer.add_page(numbered(page, number, product["total"]))
    temp_path = folder / f".{product['key']}-enhanced.tmp.pdf"
    with temp_path.open("wb") as handle:
        writer.write(handle)
    final_path = folder / product["output"]
    temp_path.replace(final_path)

    preview_writer = PdfWriter()
    final_reader = PdfReader(str(final_path))
    for index in (0, 1, 3, 4):
        preview_writer.add_page(final_reader.pages[index])
    preview_path = folder / product["preview"]
    with preview_path.open("wb") as handle:
        preview_writer.write(handle)

    upload_text = upload_copy(product)
    (folder / product["upload"]).write_text(upload_text, encoding="utf-8", newline="\n")
    return final_path, preview_path


def upload_copy(product: dict) -> str:
    topics = "\n".join(f"- {index}일차 {topic}" for index, topic in enumerate(product["topics"], 1))
    return f"""# 업로드용 상품정보

## 1. 자료 제목

{product['title']}

## 2. 짧은 요약

{product['summary']}

## 3. 상세 설명

{product['description']}

## 4. 키워드

{', '.join(product['keywords'])}

## 5. 공개자료 구성

- 구성 페이지수: PDF 총 {product['total']}쪽 — 표지 1쪽, 자료 정보 1쪽, 사용 안내 1쪽, 일차별 읽기·기록 {len(product['topics']) * 2}쪽, 함께 활용하기 2쪽, 여정 회고 1쪽, 이용 안내 1쪽
- 이 기도를 통해 목표하는 부분: {product['goal']}
- 목차:
{topics}
- 공개 미리보기: 표지 · 자료 정보 · 1일차 읽기 · 1일차 기록, 총 4쪽
"""


def verify(product: dict, full_path: Path, preview_path: Path) -> None:
    full = PdfReader(str(full_path))
    preview = PdfReader(str(preview_path))
    if len(full.pages) != product["total"] or len(preview.pages) != 4:
        raise RuntimeError(f"page count verification failed for {product['title']}")
    text = "\n".join(page.extract_text() or "" for page in full.pages)
    required = [product["title"], "함께 활용하기", "비영리 인쇄", "저작권과 이용 범위", *product["topics"]]
    missing = [item for item in required if item not in text]
    if missing:
        raise RuntimeError(f"missing text for {product['title']}: {missing}")
    if re.search(r"(?:판매가|가격|₩|[0-9]{1,3}(?:,[0-9]{3})+원)", text):
        raise RuntimeError(f"price-like text found in {product['title']}")


def main() -> None:
    register_font()
    for product in PRODUCTS:
        full_path, preview_path = build_product(product)
        verify(product, full_path, preview_path)
        print(full_path)
        print(preview_path)


if __name__ == "__main__":
    main()
