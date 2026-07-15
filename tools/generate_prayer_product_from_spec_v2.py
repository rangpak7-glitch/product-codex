"""Generate daily prayer products with a detailed '공개자료 구성' section."""

import importlib.util
import json
from pathlib import Path


CORE_PATH = Path(__file__).with_name("generate_prayer_product_from_spec.py")


def load_core():
    spec = importlib.util.spec_from_file_location("prayer_product_core_v2", CORE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


core = load_core()
original_validate_spec = core.validate_spec


def validate_spec(spec, lookup):
    validated = original_validate_spec(spec, lookup)
    core.required_string(validated, "prayer_goal", "spec")
    return validated


def public_material_text(spec):
    day_toc = " · ".join(
        f"{index}일차 {day['topic']}" for index, day in enumerate(spec["days"], 1)
    )
    return (
        f"- 구성 페이지수: 유료본 PDF 총 {core.TOTAL_PAGES}쪽\n"
        "- 목차: 표지 1쪽 · 자료 정보 1쪽 · 사용 안내 1쪽 · "
        f"7일 읽기 7쪽 · 7일 기록과 실천 7쪽 · 여정 회고 1쪽 · 이용 안내 1쪽 / {day_toc}\n"
        f"- 이 기도를 통해 목표하는 부분: {spec['prayer_goal']}"
    )


def write_upload_copy(spec, path):
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

{public_material_text(spec)}
"""
    path.write_text(text, encoding="utf-8")


def verify_product(base, spec, paths):
    paid = base.PdfReader(str(paths["paid"]))
    preview = base.PdfReader(str(paths["preview"]))
    if len(paid.pages) != core.TOTAL_PAGES or len(preview.pages) != 4:
        raise ValueError(f"Page count mismatch for {spec['title']}")
    all_paid_text = "\n".join(page.extract_text() or "" for page in paid.pages)
    all_preview_text = "\n".join(page.extract_text() or "" for page in preview.pages)
    if core.PRICE_PATTERN.search(all_paid_text) or core.PRICE_PATTERN.search(all_preview_text):
        raise ValueError(f"Price text found in PDF: {spec['title']}")
    info = core.normalize_pdf_text(paid.pages[1].extract_text())
    for value in (spec["title"], spec["summary"], spec["description"]):
        if core.normalize_pdf_text(value) not in info:
            raise ValueError(f"Metadata mismatch in PDF: {spec['title']}")
    for index, day in enumerate(spec["days"]):
        text = core.normalize_pdf_text(paid.pages[3 + index * 2].extract_text())
        if core.normalize_pdf_text(day["reference"]) not in text:
            raise ValueError(f"Reference missing: {day['reference']}")
        if any(core.normalize_pdf_text(verse) not in text for verse in day["scripture"]):
            raise ValueError(f"Scripture missing: {day['reference']}")
    for page in paid.pages:
        if abs(float(page.mediabox.width) - 595.2756) >= 0.1 or abs(float(page.mediabox.height) - 841.8898) >= 0.1:
            raise ValueError(f"Non-A4 page found: {spec['title']}")
    upload_text = paths["upload"].read_text(encoding="utf-8")
    for label in ("자료 제목", "짧은 요약", "상세 설명", "키워드", "공개자료 구성"):
        if label not in upload_text:
            raise ValueError(f"Upload field missing: {label}")
    for value in (
        f"유료본 PDF 총 {core.TOTAL_PAGES}쪽",
        *(day["topic"] for day in spec["days"]),
        spec["prayer_goal"],
    ):
        if value not in upload_text:
            raise ValueError(f"공개자료 구성 내용 누락: {value}")
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
        "public_material_pages_toc_goal_verified": True,
        "visual_validation_required_before_registry": True,
    }
    paths["validation"].write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return result


core.validate_spec = validate_spec
core.write_upload_copy = write_upload_copy
core.verify_product = verify_product


if __name__ == "__main__":
    core.main()
