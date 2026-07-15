"""Generate and validate one or more 7-day paid prayer products from JSON specs."""

import argparse
import importlib.util
import json
import re
from pathlib import Path

from prayer_pdf_sales_layout import install_no_price_brand_layout


ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "tools" / "generate_paid_prayer_pdf.py"
DEFAULT_REGISTRY = ROOT / "data" / "prayer-pdf-registry.json"
DEFAULT_KRV = Path(r"D:\codex\tmp\krv-source-full\json\88.json")
ALLOWED_OUTPUT_ROOT = Path(r"D:\codex\sinang\prayPDF")
TOTAL_PAGES = 19
PRICE_PATTERN = re.compile(r"판매가|[₩￦]\s*\d|(?:\d{1,3}(?:,\d{3})+|\d+)\s*원")
UNIQUE_FIELDS = ("topic", "reference", "focus", "practice_key")


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def compact(value):
    return re.sub(r"\s+", "", str(value)).casefold()


def safe_filename(value):
    return re.sub(r"[^0-9A-Za-z가-힣_-]+", "_", value).strip("_")


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate_output_dir(path):
    resolved = Path(path).resolve()
    allowed = ALLOWED_OUTPUT_ROOT.resolve()
    if resolved != allowed and allowed not in resolved.parents:
        raise ValueError(f"Output path must stay under {allowed}: {resolved}")
    return resolved


def build_krv_lookup(path):
    data = read_json(path)
    return {book["info"]["name"]: book for book in data["book"].values()}


def expected_scripture(reference, lookup):
    match = re.fullmatch(r"(.+?)\s+(\d+):(\d+)(?:-(\d+))?", reference.strip())
    if not match:
        raise ValueError(f"Unsupported Bible reference: {reference}")
    book_name, chapter, first, last = match.groups()
    first_verse = int(first)
    last_verse = int(last or first)
    if last_verse < first_verse or last_verse - first_verse + 1 > 3:
        raise ValueError(f"Each day must contain 1-3 verses: {reference}")
    try:
        chapter_data = lookup[book_name]["chapter"][str(int(chapter))]["verse"]
        return [f"{verse} {chapter_data[str(verse)]['text']}" for verse in range(first_verse, last_verse + 1)]
    except KeyError as exc:
        raise ValueError(f"Reference not found in KRV data: {reference}") from exc


def required_string(mapping, key, context):
    value = mapping.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Missing {context}.{key}")
    return value.strip()


def validate_spec(spec, lookup):
    for key in ("title", "product_theme", "summary", "description", "use_scope", "created_on", "output_dir"):
        required_string(spec, key, "spec")
    keywords = spec.get("keywords")
    if not isinstance(keywords, list) or not 3 <= len(keywords) <= 8 or not all(isinstance(v, str) and v.strip() for v in keywords):
        raise ValueError("keywords must contain 3-8 non-empty strings")
    for section in ("cover", "guide", "reflection"):
        if not isinstance(spec.get(section), dict):
            raise ValueError(f"Missing spec.{section}")
    for key in ("line_1", "line_2", "subtitle", "journey_line"):
        required_string(spec["cover"], key, "cover")
    for key in ("headline", "intro", "closing_title", "closing_body"):
        required_string(spec["guide"], key, "guide")
    for key in ("headline", "intro"):
        required_string(spec["reflection"], key, "reflection")
    reflection_blocks = spec["reflection"].get("blocks")
    if not isinstance(reflection_blocks, list) or len(reflection_blocks) != 3:
        raise ValueError("reflection.blocks must contain exactly three entries")
    for index, block in enumerate(reflection_blocks, 1):
        required_string(block, "title", f"reflection.blocks[{index}]")
        required_string(block, "hint", f"reflection.blocks[{index}]")
    days = spec.get("days")
    if not isinstance(days, list) or len(days) != 7:
        raise ValueError("A daily product must contain exactly seven days")
    for index, day in enumerate(days, 1):
        for key in ("topic", "reference", "focus", "practice_key", "title", "meditation", "prayer", "prompt", "practice"):
            required_string(day, key, f"days[{index}]")
        day["number"] = f"DAY {index}"
        expected = expected_scripture(day["reference"], lookup)
        if day.get("scripture") != expected:
            raise ValueError(f"KRV text mismatch at {day['reference']}")
    for field in UNIQUE_FIELDS:
        values = [compact(day[field]) for day in days]
        if len(values) != len(set(values)):
            raise ValueError(f"Duplicate {field} inside {spec['title']}")
    serialized = json.dumps(spec, ensure_ascii=False)
    if PRICE_PATTERN.search(serialized):
        raise ValueError(f"Price text is not allowed in product spec: {spec['title']}")
    spec["output_dir"] = str(validate_output_dir(spec["output_dir"]))
    return spec


def collect_registry_values(registry):
    values = {"title": set(), "product_theme": set(), **{field: set() for field in UNIQUE_FIELDS}}
    for product in registry.get("products", []):
        values["title"].add(compact(product["title"]))
        values["product_theme"].add(compact(product["product_theme"]))
        for day in product.get("days", []):
            for field in UNIQUE_FIELDS:
                values[field].add(compact(day[field]))
    return values


def validate_against_registry(specs, registry):
    seen = collect_registry_values(registry)
    for spec in specs:
        for field in ("title", "product_theme"):
            value = compact(spec[field])
            if value in seen[field]:
                raise ValueError(f"Registry duplicate {field}: {spec[field]}")
            seen[field].add(value)
        for day in spec["days"]:
            for field in UNIQUE_FIELDS:
                value = compact(day[field])
                if value in seen[field]:
                    raise ValueError(f"Registry or batch duplicate {field}: {day[field]}")
                seen[field].add(value)


def install_guide(base, guide_spec):
    def guide(c, page_no):
        base.page_background(c)
        c.setFillColor(base.GOLD)
        c.setFont(base.SANS, 12)
        c.drawString(base.MARGIN_X, base.PAGE_H - 79, "사용 안내")
        c.setFillColor(base.NAVY)
        c.setFont(base.SERIF, 29)
        c.drawString(base.MARGIN_X, base.PAGE_H - 121, guide_spec["headline"])
        y = base.PAGE_H - 178
        y = base.write_wrapped(c, guide_spec["intro"], base.MARGIN_X, y, base.PAGE_W - base.MARGIN_X * 2, size=14.5, leading=26, color=base.NAVY)
        steps = [
            ("1", "개역한글 본문을 천천히 읽습니다", "장절과 본문을 따라 읽으며 오늘 마음에 머무는 문장을 살펴보세요."),
            ("2", "묵상과 기도문을 내 마음으로 읽습니다", "기도문을 그대로 읽거나 지금의 상황에 맞는 말로 이어 기도해도 좋습니다."),
            ("3", "기록과 작은 실천으로 이어 갑니다", "응답을 재촉하지 않고 오늘 할 수 있는 구체적인 행동 하나를 남겨 보세요."),
        ]
        y -= 34
        for number, title, body in steps:
            c.setFillColor(base.GOLD)
            c.circle(base.MARGIN_X + 18, y + 4, 18, fill=1, stroke=0)
            c.setFillColor(base.DEEP_NAVY)
            c.setFont(base.SANS, 12)
            c.drawCentredString(base.MARGIN_X + 18, y, number)
            c.setFillColor(base.NAVY)
            c.setFont(base.SANS, 15)
            c.drawString(base.MARGIN_X + 54, y, title)
            y = base.write_wrapped(c, body, base.MARGIN_X + 54, y - 28, base.PAGE_W - base.MARGIN_X * 2 - 54, size=13, leading=22, color=base.MUTED) - 32
        c.setFillColor(base.BEIGE)
        c.roundRect(base.MARGIN_X, 106, base.PAGE_W - base.MARGIN_X * 2, 88, 12, fill=1, stroke=0)
        c.setFillColor(base.NAVY)
        c.setFont(base.SERIF, 16)
        c.drawString(base.MARGIN_X + 20, 162, guide_spec["closing_title"])
        base.write_wrapped(c, guide_spec["closing_body"], base.MARGIN_X + 20, 134, base.PAGE_W - base.MARGIN_X * 2 - 40, size=13, leading=22, color=base.NAVY)
        base.footer(c, page_no)
        c.showPage()
    base.guide = guide


def install_reflection(base, reflection_spec):
    def reflection_page(c, page_no):
        base.page_background(c)
        c.setFillColor(base.GOLD)
        c.setFont(base.SANS, 12)
        c.drawString(base.MARGIN_X, base.PAGE_H - 79, "여정 회고")
        c.setFillColor(base.NAVY)
        c.setFont(base.SERIF, 30)
        c.drawString(base.MARGIN_X, base.PAGE_H - 121, reflection_spec["headline"])
        c.setFillColor(base.NAVY)
        c.setFont(base.SANS, 13.5)
        c.drawString(base.MARGIN_X, base.PAGE_H - 159, reflection_spec["intro"])
        y = base.PAGE_H - 220
        for block in reflection_spec["blocks"]:
            c.setFillColor(base.BEIGE)
            c.roundRect(base.MARGIN_X, y - 27, base.PAGE_W - base.MARGIN_X * 2, 34, 10, fill=1, stroke=0)
            c.setFillColor(base.NAVY)
            c.setFont(base.SANS, 13)
            c.drawString(base.MARGIN_X + 14, y - 15, block["title"])
            c.setFillColor(base.MUTED)
            c.setFont(base.SANS, 11.5)
            c.drawString(base.MARGIN_X, y - 52, block["hint"])
            c.setStrokeColor(base.LINE)
            c.setLineWidth(0.7)
            for offset in range(0, 70, 24):
                c.line(base.MARGIN_X, y - 80 - offset, base.PAGE_W - base.MARGIN_X, y - 80 - offset)
            y -= 175
        base.footer(c, page_no)
        c.showPage()
    base.reflection_page = reflection_page


def product_paths(spec):
    output_dir = Path(spec["output_dir"])
    name = safe_filename(spec["title"])
    return {
        "output_dir": output_dir,
        "paid": output_dir / f"{name}_유료본.pdf",
        "preview": output_dir / f"{name}_미리보기.pdf",
        "upload": output_dir / f"{name}_업로드용_상품정보.md",
        "validation": output_dir / f"{name}_자동검증.json",
    }


def write_upload_copy(spec, path):
    public = "표지 · 자료 정보 · 1일차 읽기 · 1일차 기록, 총 4쪽"
    text = f"""# {spec['title']} - 업로드용 상품정보

## 1. 자료 제목

{spec['title']}

## 2. 짧은 요약

{spec['summary']}

## 3. 상세 설명

{spec['description']}

## 4. 키워드

{', '.join(spec['keywords'])}

## 5. 공개자료 구성

{public}
"""
    path.write_text(text, encoding="utf-8")


def make_preview(base, paid_path, preview_path, title):
    reader = base.PdfReader(str(paid_path))
    if len(reader.pages) != TOTAL_PAGES:
        raise ValueError(f"Expected {TOTAL_PAGES} paid pages, got {len(reader.pages)}")
    writer = base.PdfWriter()
    for page_index in (0, 1, 3, 4):
        writer.add_page(reader.pages[page_index])
    writer.add_metadata({
        "/Title": f"{title} 미리보기",
        "/Author": "기도의샘물",
        "/Subject": "공개 미리보기: 표지, 자료 정보, DAY 1 읽기·기록",
    })
    with preview_path.open("wb") as output_file:
        writer.write(output_file)


def normalize_pdf_text(value):
    return re.sub(r"\s+", "", value or "")


def verify_product(base, spec, paths):
    paid = base.PdfReader(str(paths["paid"]))
    preview = base.PdfReader(str(paths["preview"]))
    if len(paid.pages) != TOTAL_PAGES or len(preview.pages) != 4:
        raise ValueError(f"Page count mismatch for {spec['title']}")
    all_paid_text = "\n".join(page.extract_text() or "" for page in paid.pages)
    all_preview_text = "\n".join(page.extract_text() or "" for page in preview.pages)
    if PRICE_PATTERN.search(all_paid_text) or PRICE_PATTERN.search(all_preview_text):
        raise ValueError(f"Price text found in PDF: {spec['title']}")
    info = normalize_pdf_text(paid.pages[1].extract_text())
    for value in (spec["title"], spec["summary"], spec["description"]):
        if normalize_pdf_text(value) not in info:
            raise ValueError(f"Metadata mismatch in PDF: {spec['title']}")
    for index, day in enumerate(spec["days"]):
        text = normalize_pdf_text(paid.pages[3 + index * 2].extract_text())
        if normalize_pdf_text(day["reference"]) not in text:
            raise ValueError(f"Reference missing: {day['reference']}")
        if any(normalize_pdf_text(verse) not in text for verse in day["scripture"]):
            raise ValueError(f"Scripture missing: {day['reference']}")
    for page in paid.pages:
        if abs(float(page.mediabox.width) - 595.2756) >= 0.1 or abs(float(page.mediabox.height) - 841.8898) >= 0.1:
            raise ValueError(f"Non-A4 page found: {spec['title']}")
    upload_text = paths["upload"].read_text(encoding="utf-8")
    for label in ("자료 제목", "짧은 요약", "상세 설명", "키워드", "공개자료 구성"):
        if label not in upload_text:
            raise ValueError(f"Upload field missing: {label}")
    result = {
        "status": "automatic_validation_passed",
        "title": spec["title"],
        "paid_pages": len(paid.pages),
        "preview_pages": len(preview.pages),
        "unique_days": len(spec["days"]),
        "price_text_absent": True,
        "a4_verified": True,
        "metadata_verified": True,
        "scripture_verified_against_krv": True,
        "visual_validation_required_before_registry": True,
    }
    paths["validation"].write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def generate_product(spec):
    paths = product_paths(spec)
    paths["output_dir"].mkdir(parents=True, exist_ok=True)
    base = load_module(f"prayer_base_{safe_filename(spec['title'])}", BASE_PATH)
    base.TOTAL_PAGES = TOTAL_PAGES
    base.MATERIAL_INFO = {
        "title": spec["title"],
        "summary": spec["summary"],
        "description": spec["description"],
        "keywords": spec["keywords"],
        "use_scope": spec["use_scope"],
    }
    base.DAYS = spec["days"]
    install_no_price_brand_layout(
        base,
        title=spec["title"],
        cover_line_1=spec["cover"]["line_1"],
        cover_line_2=spec["cover"]["line_2"],
        subtitle=spec["cover"]["subtitle"],
        journey_line=spec["cover"]["journey_line"],
        scope_text=spec["use_scope"],
        cover_size_1=float(spec["cover"].get("size_1", 35)),
        cover_size_2=float(spec["cover"].get("size_2", 47)),
    )
    install_guide(base, spec["guide"])
    install_reflection(base, spec["reflection"])
    base.register_fonts()
    c = base.ReadabilityCanvas(str(paths["paid"]), pagesize=base.A4, pageCompression=1)
    c.setTitle(spec["title"])
    c.setAuthor("기도의샘물")
    c.setSubject(f"성경전서 개역한글판 본문 수록 · {spec['product_theme']}")
    c.setKeywords(", ".join(spec["keywords"]))
    base.cover(c)
    base.material_info_page(c, 2)
    base.guide(c, 3)
    page_no = 4
    for day in spec["days"]:
        base.reading_page(c, day, page_no)
        base.journal_page(c, day, page_no + 1)
        page_no += 2
    base.reflection_page(c, 18)
    base.rights_page(c, 19)
    c.save()
    make_preview(base, paths["paid"], paths["preview"], spec["title"])
    write_upload_copy(spec, paths["upload"])
    verify_product(base, spec, paths)
    return paths


def register_specs(specs, registry_path):
    registry = read_json(registry_path)
    validate_against_registry(specs, registry)
    for spec in specs:
        paths = product_paths(spec)
        base = load_module(f"register_verify_{safe_filename(spec['title'])}", BASE_PATH)
        verify_product(base, spec, paths)
        registry["products"].append({
            "title": spec["title"],
            "product_theme": spec["product_theme"],
            "created_on": spec["created_on"],
            "output_dir": spec["output_dir"],
            "days": [
                {field: day[field] for field in UNIQUE_FIELDS}
                for day in spec["days"]
            ],
        })
    Path(registry_path).write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", action="append", required=True, help="Path to a UTF-8 JSON product spec; repeat for a batch")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    parser.add_argument("--krv", default=str(DEFAULT_KRV))
    parser.add_argument("--register-only", action="store_true", help="Verify existing outputs and append specs to the registry")
    return parser.parse_args()


def main():
    args = parse_args()
    if len(args.spec) != 2:
        raise ValueError("Daily production requires exactly two --spec arguments")
    lookup = build_krv_lookup(args.krv)
    specs = [validate_spec(read_json(path), lookup) for path in args.spec]
    registry = read_json(args.registry)
    validate_against_registry(specs, registry)
    if args.register_only:
        register_specs(specs, args.registry)
        print(f"Registered {len(specs)} visually approved products in {args.registry}")
        return
    for spec in specs:
        paths = generate_product(spec)
        print(paths["paid"])
        print(paths["preview"])
        print(paths["upload"])
        print(paths["validation"])


if __name__ == "__main__":
    main()
