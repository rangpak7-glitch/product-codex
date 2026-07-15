"""Generate two non-duplicate 21-page prayer products with topic-specific covers."""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path


V2_PATH = Path(__file__).with_name("generate_prayer_product_from_spec_v2.py")


def load_v2():
    spec = importlib.util.spec_from_file_location("prayer_product_v2_for_v3", V2_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v2 = load_v2()
core = v2.core
core.TOTAL_PAGES = 21


def cover_style_for(product):
    explicit = str(product.get("cover", {}).get("style", "")).strip().casefold()
    if explicit in {"family", "wisdom", "work", "rest", "courage", "default"}:
        return explicit
    searchable = core.compact(" ".join([product["title"], product["product_theme"], *product["keywords"]]))
    rules = (
        ("wisdom", ("잠언", "지혜", "분별")),
        ("work", ("일터", "생업", "직장", "사업")),
        ("rest", ("쉼", "위로", "불안", "회복")),
        ("courage", ("용기", "결단", "두려움")),
        ("family", ("가정", "자녀", "부모")),
    )
    for style, words in rules:
        if any(word in searchable for word in words):
            return style
    return "default"


def install_topic_cover(base, product):
    style = cover_style_for(product)

    def cover(c):
        if style == "family":
            c.setFillColor(base.HexColor("#EEF1E8")); c.rect(0, 0, base.PAGE_W, base.PAGE_H, fill=1, stroke=0)
            c.setFillColor(base.SAGE); c.rect(0, 0, base.PAGE_W * 0.36, base.PAGE_H, fill=1, stroke=0)
            c.setStrokeColor(base.NAVY); c.setLineWidth(2.4)
            c.roundRect(72, 112, base.PAGE_W - 144, base.PAGE_H - 224, 150, fill=0, stroke=1)
            c.setStrokeColor(base.GOLD); c.setLineWidth(1.2)
            c.line(108, 176, 108, 506); c.line(108, 356, 188, 432); c.line(108, 420, 66, 480)
            for x, y in ((188, 432), (66, 480), (108, 506)):
                c.circle(x, y, 11, fill=0, stroke=1)
            text_color = base.NAVY
            accent = base.HexColor("#7E5D28")
        elif style == "wisdom":
            c.setFillColor(base.HexColor("#172238")); c.rect(0, 0, base.PAGE_W, base.PAGE_H, fill=1, stroke=0)
            c.setStrokeColor(base.HexColor("#D8BA78")); c.setLineWidth(1)
            cx, cy = base.PAGE_W - 110, base.PAGE_H - 145
            for radius in (34, 57, 82):
                c.circle(cx, cy, radius, fill=0, stroke=1)
            for angle in range(0, 360, 30):
                x1 = cx + math.cos(math.radians(angle)) * 90
                y1 = cy + math.sin(math.radians(angle)) * 90
                x2 = cx + math.cos(math.radians(angle)) * 118
                y2 = cy + math.sin(math.radians(angle)) * 118
                c.line(x1, y1, x2, y2)
            c.setFillColor(base.HexColor("#213957")); c.roundRect(46, 106, base.PAGE_W - 92, 430, 18, fill=1, stroke=0)
            text_color, accent = base.WHITE, base.GOLD
        elif style == "work":
            c.setFillColor(base.HexColor("#152128")); c.rect(0, 0, base.PAGE_W, base.PAGE_H, fill=1, stroke=0)
            c.setStrokeColor(base.HexColor("#677A78")); c.setLineWidth(0.75)
            for y in range(110, 640, 48):
                c.line(0, y, base.PAGE_W, y + 70)
            for x in range(-120, 700, 68):
                c.line(x, 80, x + 280, 670)
            c.setFillColor(base.GOLD); c.rect(0, 92, base.PAGE_W, 10, fill=1, stroke=0)
            text_color, accent = base.WHITE, base.GOLD
        elif style == "rest":
            c.setFillColor(base.HexColor("#E8EEE9")); c.rect(0, 0, base.PAGE_W, base.PAGE_H, fill=1, stroke=0)
            c.setStrokeColor(base.HexColor("#71877C")); c.setLineWidth(1.2)
            for offset in range(5):
                c.bezier(0, 170 + offset * 34, 160, 280 + offset * 32, 350, 50 + offset * 42, base.PAGE_W, 180 + offset * 30)
            c.setFillColor(base.HexColor("#C9D6C6")); c.circle(base.PAGE_W - 104, base.PAGE_H - 128, 76, fill=1, stroke=0)
            text_color, accent = base.NAVY, base.HexColor("#7E5D28")
        elif style == "courage":
            c.setFillColor(base.HexColor("#291E2A")); c.rect(0, 0, base.PAGE_W, base.PAGE_H, fill=1, stroke=0)
            c.setFillColor(base.GOLD); c.wedge(base.PAGE_W - 220, base.PAGE_H - 290, base.PAGE_W + 40, base.PAGE_H - 30, 210, 120, fill=1, stroke=0)
            c.setStrokeColor(base.HexColor("#D7B66D")); c.setLineWidth(1.1)
            for inset in (54, 78, 102):
                c.line(inset, 100, base.PAGE_W - inset, base.PAGE_H - 100)
            text_color, accent = base.WHITE, base.GOLD
        else:
            c.setFillColor(base.DEEP_NAVY); c.rect(0, 0, base.PAGE_W, base.PAGE_H, fill=1, stroke=0)
            c.setStrokeColor(base.GOLD); c.setLineWidth(1)
            for inset in (56, 78, 100):
                c.arc(inset, 110, base.PAGE_W - inset, base.PAGE_H - 70, 0, 180)
            text_color, accent = base.WHITE, base.GOLD

        c.setFillColor(accent); c.setFont(base.SANS, 11)
        c.drawString(58, base.PAGE_H - 72, "기도의샘물 · PRAYER JOURNAL")
        c.setFillColor(text_color); c.setFont(base.SERIF, float(product["cover"].get("size_1", 35)))
        c.drawString(58, base.PAGE_H - 304, product["cover"]["line_1"])
        c.setFont(base.SERIF, float(product["cover"].get("size_2", 47)))
        c.drawString(58, base.PAGE_H - 366, product["cover"]["line_2"])
        c.setFillColor(accent); c.rect(58, base.PAGE_H - 402, 92, 3, fill=1, stroke=0)
        base.write_wrapped(c, product["cover"]["subtitle"], 58, base.PAGE_H - 438, base.PAGE_W - 116, size=14, leading=24, color=text_color)
        c.setFillColor(text_color); c.setFont(base.SANS, 11)
        c.drawString(58, 58, "큰 글씨 · 말씀 · 기도 · 기록 · 작은 실천")
        c.setFillColor(accent); c.setFont(base.SANS, 9.5)
        c.drawRightString(base.PAGE_W - 52, 32, f"01 / {core.TOTAL_PAGES:02d}")
        c.showPage()

    base.cover = cover


def install_product_footer(base, product):
    def footer(c, page_no):
        c.setStrokeColor(base.HexColor("#CFC2AB")); c.setLineWidth(0.7)
        c.line(base.MARGIN_X, 42, base.PAGE_W - base.MARGIN_X, 42)
        c.setFillColor(base.NAVY); c.setFont(base.SANS, 9.5)
        c.drawString(base.MARGIN_X, 25, f"기도의샘물  |  {product['title']}")
        c.drawRightString(base.PAGE_W - base.MARGIN_X, 25, f"{page_no:02d} / {core.TOTAL_PAGES:02d}")
    base.footer = footer


def install_group_pages(base):
    def group_method_page(c, page_no):
        base.page_background(c)
        c.setFillColor(base.GOLD); c.setFont(base.SANS, 12); c.drawString(base.MARGIN_X, base.PAGE_H - 79, "함께 활용하기")
        c.setFillColor(base.NAVY); c.setFont(base.SERIF, 28); c.drawString(base.MARGIN_X, base.PAGE_H - 121, "개인 · 가정 · 소그룹 사용법")
        modes = [
            ("개인 묵상", "10~15분을 정해 말씀과 기도문을 읽고, 오늘의 기록 한 문장과 작은 실천 한 가지를 남깁니다."),
            ("가정예배", "한 사람이 말씀과 묵상을 읽고 각자 한 문장씩 기도합니다. 기록은 강요하지 않고 함께 실천할 한 가지를 정합니다."),
            ("소그룹", "모임 전에 각자 한 일차를 사용합니다. 나누어도 되는 한 문장만 자발적으로 나누고 서로의 비밀을 지킵니다."),
        ]
        y = base.PAGE_H - 166
        for number, (label, body) in enumerate(modes, 1):
            c.setFillColor(base.WHITE); c.roundRect(base.MARGIN_X, y - 116, base.PAGE_W - base.MARGIN_X * 2, 102, 12, fill=1, stroke=0)
            c.setFillColor(base.GOLD); c.circle(base.MARGIN_X + 28, y - 43, 16, fill=1, stroke=0)
            c.setFillColor(base.WHITE); c.setFont(base.SANS, 12); c.drawCentredString(base.MARGIN_X + 28, y - 48, str(number))
            c.setFillColor(base.NAVY); c.setFont(base.SANS, 16); c.drawString(base.MARGIN_X + 58, y - 42, label)
            base.write_wrapped(c, body, base.MARGIN_X + 58, y - 69, base.PAGE_W - base.MARGIN_X * 2 - 76, size=12.3, leading=21, color=base.MUTED)
            y -= 122
        c.setFillColor(base.SAGE); c.roundRect(base.MARGIN_X, 112, base.PAGE_W - base.MARGIN_X * 2, 112, 12, fill=1, stroke=0)
        c.setFillColor(base.NAVY); c.setFont(base.SANS, 15); c.drawString(base.MARGIN_X + 18, 194, "30분 소그룹 흐름")
        base.write_wrapped(c, "마음 열기 5분 · 말씀과 묵상 7분 · 함께 기도 10분 · 기록과 실천 5분 · 마침기도 3분", base.MARGIN_X + 18, 166, base.PAGE_W - base.MARGIN_X * 2 - 36, size=12.3, leading=21, color=base.NAVY)
        base.footer(c, page_no); c.showPage()

    def group_safety_page(c, page_no):
        base.page_background(c)
        c.setFillColor(base.GOLD); c.setFont(base.SANS, 12); c.drawString(base.MARGIN_X, base.PAGE_H - 79, "함께 활용하기")
        c.setFillColor(base.NAVY); c.setFont(base.SERIF, 28); c.drawString(base.MARGIN_X, base.PAGE_H - 121, "안전하게 나누고 인쇄하는 기준")
        blocks = [
            ("비영리 인쇄", "구매 1건에는 교회·기관의 비영리 모임을 위한 인쇄 20부까지 포함됩니다. 초과 부수는 웹사이트에서 추가 인쇄 이용권을 선택해 주세요."),
            ("안전한 나눔", "기록 공개를 강요하지 않습니다. 실명과 민감한 사정을 온라인에 올리지 않으며, 모임에서 들은 이야기를 밖으로 옮기지 않습니다."),
            ("진행자의 역할", "정답보다 경청을 우선하고 응답이나 치유를 보장하는 표현을 피합니다. 필요한 경우 의료·법률·재정 전문 지원과 연결합니다."),
            ("파일 이용", "PDF 파일 자체를 단체 채팅방, 온라인 저장소, SNS에 공유하거나 재판매·편집·재배포하지 않습니다."),
        ]
        y = base.PAGE_H - 160
        for index, (label, body) in enumerate(blocks):
            c.setFillColor(base.SAGE if index % 2 == 0 else base.BEIGE)
            c.roundRect(base.MARGIN_X, y - 122, base.PAGE_W - base.MARGIN_X * 2, 108, 12, fill=1, stroke=0)
            c.setFillColor(base.NAVY); c.setFont(base.SANS, 15); c.drawString(base.MARGIN_X + 18, y - 42, label)
            base.write_wrapped(c, body, base.MARGIN_X + 18, y - 69, base.PAGE_W - base.MARGIN_X * 2 - 36, size=12.1, leading=20, color=base.NAVY)
            y -= 124
        base.footer(c, page_no); c.showPage()

    def rights_page(c, page_no):
        base.page_background(c)
        c.setFillColor(base.GOLD); c.setFont(base.SANS, 12); c.drawString(base.MARGIN_X, base.PAGE_H - 79, "이용 안내")
        c.setFillColor(base.NAVY); c.setFont(base.SERIF, 30); c.drawString(base.MARGIN_X, base.PAGE_H - 121, "저작권과 이용 범위")
        sections = [
            ("성경 본문", "성경전서 개역한글판 · 대한성서공회 · 1961. 장절과 본문은 개역한글 원문을 기준으로 사용했습니다."),
            ("기도문과 편집", "묵상, 기도문, 기록 질문, 편집 디자인은 기도의샘물의 신규 창작물입니다."),
            ("허용 범위", "구매자 개인·가정의 열람과 인쇄, 교회·기관 비영리 모임의 20부 이내 인쇄를 허용합니다."),
            ("허용하지 않는 이용", "파일 공유, 온라인 게시, 재판매, 편집 후 재배포, 상업 수업·상품의 부속 자료 사용은 허용하지 않습니다."),
            ("안내", "이 자료는 기도를 돕는 자료이며 특정한 응답, 치유, 결과를 보장하지 않습니다."),
        ]
        y = base.PAGE_H - 174
        for heading, body in sections:
            c.setFillColor(base.GOLD); c.setFont(base.SANS, 13); c.drawString(base.MARGIN_X, y, heading)
            y = base.write_wrapped(c, body, base.MARGIN_X, y - 27, base.PAGE_W - base.MARGIN_X * 2, size=12.3, leading=21, color=base.NAVY) - 25
        c.setFillColor(base.DEEP_NAVY); c.roundRect(base.MARGIN_X, 88, base.PAGE_W - base.MARGIN_X * 2, 72, 12, fill=1, stroke=0)
        c.setFillColor(base.WHITE); c.setFont(base.SERIF, 15); c.drawCentredString(base.PAGE_W / 2, 127, "기도와 말씀으로 쉬어가는 곳")
        c.setFont(base.SANS, 12); c.drawCentredString(base.PAGE_W / 2, 108, "기도의샘물")
        base.footer(c, page_no); c.showPage()

    base.group_method_page = group_method_page
    base.group_safety_page = group_safety_page
    base.rights_page = rights_page


def public_material_text(product):
    day_toc = " · ".join(f"{index}일차 {day['topic']}" for index, day in enumerate(product["days"], 1))
    return (
        "- 구성 페이지수: 유료본 PDF 총 21쪽 — 표지 1쪽 · 자료 정보 1쪽 · 사용 안내 1쪽 · "
        "7일 읽기 7쪽 · 7일 기록과 실천 7쪽 · 함께 활용하기 2쪽 · 여정 회고 1쪽 · 이용 안내 1쪽\n"
        f"- 목차: {day_toc}\n"
        f"- 이 기도를 통해 목표하는 부분: {product['prayer_goal']}\n"
        "- 공개 미리보기 범위: 표지 · 자료 정보 · 1일차 읽기 · 1일차 기록, 총 4쪽"
    )


def write_upload_copy(product, path):
    text = f"""# {product['title']} - 업로드용 상품정보

## 1. 자료 제목

{product['title']}

## 2. 짧은 요약

{product['summary']}

## 3. 상세 설명

{product['description']}

## 4. 키워드

{', '.join(product['keywords'])}

## 5. 공개자료 구성

{public_material_text(product)}
"""
    path.write_text(text, encoding="utf-8")


def generate_product(product):
    paths = core.product_paths(product)
    paths["output_dir"].mkdir(parents=True, exist_ok=True)
    base = core.load_module(f"prayer_base_v3_{core.safe_filename(product['title'])}", core.BASE_PATH)
    base.TOTAL_PAGES = core.TOTAL_PAGES
    base.MATERIAL_INFO = {
        "title": product["title"],
        "summary": product["summary"],
        "description": product["description"],
        "keywords": product["keywords"],
        "use_scope": product["use_scope"],
    }
    base.DAYS = product["days"]
    core.install_no_price_brand_layout(
        base,
        title=product["title"],
        cover_line_1=product["cover"]["line_1"],
        cover_line_2=product["cover"]["line_2"],
        subtitle=product["cover"]["subtitle"],
        journey_line=product["cover"]["journey_line"],
        scope_text=product["use_scope"],
        cover_size_1=float(product["cover"].get("size_1", 35)),
        cover_size_2=float(product["cover"].get("size_2", 47)),
    )
    install_product_footer(base, product)
    install_topic_cover(base, product)
    core.install_guide(base, product["guide"])
    core.install_reflection(base, product["reflection"])
    install_group_pages(base)
    base.register_fonts()
    c = base.ReadabilityCanvas(str(paths["paid"]), pagesize=base.A4, pageCompression=1)
    c.setTitle(product["title"]); c.setAuthor("기도의샘물")
    c.setSubject(f"성경전서 개역한글판 본문 수록 · {product['product_theme']}")
    c.setKeywords(", ".join(product["keywords"]))
    base.cover(c); base.material_info_page(c, 2); base.guide(c, 3)
    page_no = 4
    for day in product["days"]:
        base.reading_page(c, day, page_no); base.journal_page(c, day, page_no + 1); page_no += 2
    base.group_method_page(c, 18); base.group_safety_page(c, 19)
    base.reflection_page(c, 20); base.rights_page(c, 21); c.save()
    core.make_preview(base, paths["paid"], paths["preview"], product["title"])
    write_upload_copy(product, paths["upload"])
    core.verify_product(base, product, paths)
    return paths


core.write_upload_copy = write_upload_copy
core.generate_product = generate_product


if __name__ == "__main__":
    core.main()
