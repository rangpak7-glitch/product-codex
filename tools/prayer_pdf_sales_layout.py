"""Reusable sales-PDF layouts that never print the sales price."""


def install_no_price_brand_layout(
    base,
    *,
    title,
    cover_line_1,
    cover_line_2,
    subtitle,
    journey_line,
    scope_text,
    cover_size_1=39,
    cover_size_2=47,
):
    def footer(c, page_no):
        c.setStrokeColor(base.HexColor("#CFC2AB"))
        c.setLineWidth(0.7)
        c.line(base.MARGIN_X, 42, base.PAGE_W - base.MARGIN_X, 42)
        c.setFillColor(base.NAVY)
        c.setFont(base.SANS, 9.5)
        c.drawString(base.MARGIN_X, 25, f"기도의샘물  |  {title}")
        c.drawRightString(base.PAGE_W - base.MARGIN_X, 25, f"{page_no:02d} / {base.TOTAL_PAGES:02d}")

    def cover(c):
        c.setFillColor(base.DEEP_NAVY)
        c.rect(0, 0, base.PAGE_W, base.PAGE_H, fill=1, stroke=0)
        c.setFillColor(base.GOLD)
        c.rect(0, base.PAGE_H - 10, base.PAGE_W, 10, fill=1, stroke=0)
        c.setStrokeColor(base.HexColor("#263754"))
        c.setLineWidth(1.1)
        c.circle(base.PAGE_W - 65, base.PAGE_H - 105, 132, fill=0, stroke=1)
        c.circle(base.PAGE_W - 65, base.PAGE_H - 105, 94, fill=0, stroke=1)
        c.setStrokeColor(base.HexColor("#D9BB7C"))
        c.setLineWidth(0.8)
        c.roundRect(52, 75, base.PAGE_W - 104, base.PAGE_H - 150, 18, fill=0, stroke=1)
        c.setFillColor(base.HexColor("#E7C987"))
        c.setFont(base.SANS, 12.5)
        c.drawCentredString(base.PAGE_W / 2, base.PAGE_H - 175, "기도의샘물  ·  PAID PRAYER JOURNAL")
        c.setStrokeColor(base.GOLD)
        c.setLineWidth(1.1)
        c.line(base.PAGE_W / 2 - 48, base.PAGE_H - 212, base.PAGE_W / 2 + 48, base.PAGE_H - 212)
        c.setFillColor(base.WHITE)
        c.setFont(base.SERIF, cover_size_1)
        c.drawCentredString(base.PAGE_W / 2, base.PAGE_H - 312, cover_line_1)
        c.setFont(base.SERIF, cover_size_2)
        c.drawCentredString(base.PAGE_W / 2, base.PAGE_H - 373, cover_line_2)
        c.setFillColor(base.HexColor("#DDE3EC"))
        c.setFont(base.SANS, 14.5)
        c.drawCentredString(base.PAGE_W / 2, base.PAGE_H - 431, subtitle)
        c.setFillColor(base.HexColor("#E7C987"))
        c.setFont(base.SANS, 12)
        c.drawCentredString(base.PAGE_W / 2, 136, journey_line)
        c.setFont(base.SANS, 10.5)
        c.drawCentredString(base.PAGE_W / 2, 108, scope_text)
        c.setFillColor(base.HexColor("#E7C987"))
        c.setFont(base.SANS, 9.5)
        c.drawRightString(base.PAGE_W - 52, 32, f"01 / {base.TOTAL_PAGES:02d}")
        c.showPage()

    def material_info_page(c, page_no):
        base.page_background(c)
        c.setFillColor(base.GOLD)
        c.setFont(base.SANS, 12)
        c.drawString(base.MARGIN_X, base.PAGE_H - 79, "자료 정보")
        c.setFillColor(base.NAVY)
        c.setFont(base.SERIF, 29)
        c.drawString(base.MARGIN_X, base.PAGE_H - 121, "이 자료를 소개합니다")

        blocks = [
            ("자료 제목", base.MATERIAL_INFO["title"], base.NAVY, 15),
            ("짧은 요약", base.MATERIAL_INFO["summary"], base.NAVY, 13.5),
            ("키워드", " · ".join(base.MATERIAL_INFO["keywords"]), base.DEEP_NAVY, 14),
            ("상세 설명", base.MATERIAL_INFO["description"], base.NAVY, 13),
        ]
        body_width = base.PAGE_W - base.MARGIN_X * 2 - 36
        leading = 22
        prepared = []
        for label, body, color, size in blocks:
            line_count = max(1, len(base.wrap(body, base.SANS, size, body_width)))
            height = max(74, 70 + (line_count - 1) * leading)
            prepared.append((label, body, color, size, height))

        y = base.PAGE_H - 180
        for label, body, color, size, height in prepared:
            panel_bottom = y - height
            if panel_bottom < 174:
                raise ValueError(
                    "자료 정보 카드가 하단 안내 영역과 겹칩니다. "
                    "설명을 줄이거나 자료 정보 페이지를 추가하세요."
                )
            c.setFillColor(base.BEIGE if label != "키워드" else base.SAGE)
            c.roundRect(
                base.MARGIN_X,
                panel_bottom,
                base.PAGE_W - base.MARGIN_X * 2,
                height,
                12,
                fill=1,
                stroke=0,
            )
            c.setFillColor(base.GOLD)
            c.setFont(base.SANS, 10.5)
            c.drawString(base.MARGIN_X + 18, y - 24, label)
            base.write_wrapped(
                c,
                body,
                base.MARGIN_X + 18,
                y - 50,
                body_width,
                size=size,
                leading=leading,
                color=color,
            )
            y -= height + 16

        c.setFillColor(base.DEEP_NAVY)
        c.roundRect(base.MARGIN_X, 102, base.PAGE_W - base.MARGIN_X * 2, 54, 12, fill=1, stroke=0)
        c.setFillColor(base.WHITE)
        c.setFont(base.SANS, 13)
        c.drawCentredString(base.PAGE_W / 2, 130, base.MATERIAL_INFO["use_scope"])
        footer(c, page_no)
        c.showPage()

    base.footer = footer
    base.cover = cover
    base.material_info_page = material_info_page
