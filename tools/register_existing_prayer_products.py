"""Replace the three existing prayer PDF products through authenticated Supabase APIs.

Credentials are read from the terminal, used only in memory, and never written to disk.
New storage objects are uploaded before database rows are switched. The script rolls back
new rows and metadata on failure; old storage objects are deleted only after DB success.
"""

from __future__ import annotations

from datetime import datetime, timezone
import getpass
import json
import mimetypes
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

from pypdf import PdfReader


SITE_ROOT = Path(r"D:\codex\product-codex-prayer-pdf-sales")
OUTPUT_ROOT = Path(r"D:\codex\sinang\prayPDF")
CONFIG_PATH = SITE_ROOT / "assets" / "js" / "supabase-config.js"
RESULT_PATH = OUTPUT_ROOT / "관리자_등록_결과.json"
PRICE_PATTERN = re.compile(r"판매가|[₩￦]\s*\d|(?:\d{1,3}(?:,\d{3})+|\d+)\s*원")


PRODUCTS = [
    {
        "resource_id": "bdfbfab7-4798-4aa0-9a0b-617a36fd780c",
        "folder": OUTPUT_ROOT / "가정을_품는_7일_기도(샘플)",
        "pdf": "가정을_품는_7일_(샘플).pdf",
        "upload": "가정을_품는_7일_기도_업로드용_상품정보.md",
        "pages": 21,
        "days": 7,
        "access_level": "free",
        "price_amount": None,
        "sale_status": "inquiry",
        "purchasable": False,
        "hook": "가족을 위해 기도하고 싶은 오늘, 말씀과 기록으로 첫 7일을 시작해 보세요.",
        "audiences": ["가족을 위한 기도를 시작하고 싶은 분", "자녀와 가정을 위해 기도하는 부모", "가정예배와 소그룹 입문 자료가 필요한 분"],
        "benefits": ["큰 글씨로 말씀과 기도문을 편안하게 읽습니다.", "매일 기록과 작은 실천으로 기도를 삶에 연결합니다.", "개인·가정·비영리 소그룹 사용법을 함께 제공합니다."],
        "usage_modes": ["개인 묵상", "가정예배", "비영리 소그룹"],
        "purchase_goal": "가족을 향한 마음과 지친 감정을 차분히 돌아보고 일주일의 기도 리듬을 세우도록 돕습니다.",
    },
    {
        "resource_id": "6376ea6b-4df8-49a3-89fd-53f743c8f203",
        "folder": OUTPUT_ROOT / "일터와_생업을_위한_7일_기도_유료본",
        "pdf": "일터와_생업을_위한_7일_기도_유료본.pdf",
        "upload": "일터와_생업을_위한_7일_기도_업로드용_상품정보.md",
        "pages": 21,
        "days": 7,
        "access_level": "paid",
        "price_amount": 2000,
        "sale_status": "available",
        "purchasable": True,
        "hook": "일의 결과보다 오늘의 태도와 선택을 말씀 앞에 세우는 7일입니다.",
        "audiences": ["일의 무게로 마음이 흔들리는 직장인", "생업과 신앙을 연결하고 싶은 자영업자", "직장 신우회와 일터 소그룹"],
        "benefits": ["성실·정직·시간·회복·공의의 주제를 겹치지 않게 만납니다.", "출근 전이나 하루를 마친 뒤 바로 읽고 기록할 수 있습니다.", "매일 실행 가능한 한 가지 행동으로 기도를 이어 갑니다."],
        "usage_modes": ["출근 전 묵상", "하루 마무리", "직장 신우회", "비영리 소그룹"],
        "purchase_goal": "일의 태도와 선택을 말씀 앞에서 점검하고 매일 실행 가능한 행동으로 신앙과 일을 연결하도록 돕습니다.",
    },
    {
        "resource_id": "94b926a1-1a2e-4776-a7b7-232624a98c18",
        "folder": OUTPUT_ROOT / "가정을_품는_14일_기도_유료본",
        "pdf": "가정을_품는_14일_기도_유료본.pdf",
        "upload": "가정을_품는_14일_기도_업로드용_상품정보.md",
        "pages": 35,
        "days": 14,
        "access_level": "paid",
        "price_amount": 3000,
        "sale_status": "available",
        "purchasable": True,
        "hook": "막연한 가족 걱정을 말씀, 기도, 기록, 작은 실천으로 바꾸는 14일입니다.",
        "audiences": ["자녀와 가족을 위해 꾸준히 기도하고 싶은 부모", "가정예배를 차분히 이어 가고 싶은 가정", "부모 모임과 비영리 소그룹 인도자"],
        "benefits": ["자녀와 가정의 14개 상황을 서로 다른 말씀과 기도로 다룹니다.", "큰 글씨와 충분한 기록 공간으로 읽기와 쓰기를 함께 돕습니다.", "개인 묵상부터 가정예배와 소그룹까지 활용할 수 있습니다."],
        "usage_modes": ["개인 묵상", "가정예배", "부모 모임", "비영리 소그룹"],
        "purchase_goal": "가족을 향한 걱정을 구체적인 기도와 기록, 작은 실천으로 바꾸고 14일의 기도 습관을 세우도록 돕습니다.",
    },
]


class ApiError(RuntimeError):
    pass


def read_config() -> tuple[str, str]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    match = re.search(r"createClient\(\s*\"([^\"]+)\"\s*,\s*\"([^\"]+)\"", text)
    if not match:
        raise RuntimeError("Supabase public configuration was not found")
    return match.group(1).rstrip("/"), match.group(2)


def request_json(method: str, url: str, *, headers: dict[str, str], body=None, expected=(200, 201, 204)):
    data = None
    request_headers = dict(headers)
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(url, data=data, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            if response.status not in expected:
                raise ApiError(f"Unexpected HTTP {response.status} for {method} {url}")
            if not raw:
                return None
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ApiError(f"HTTP {exc.code} for {method} {url}: {detail[:800]}") from exc


def upload_binary(url: str, path: Path, *, headers: dict[str, str]) -> dict:
    request_headers = dict(headers)
    request_headers["Content-Type"] = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    request_headers["x-upsert"] = "false"
    request = urllib.request.Request(url, data=path.read_bytes(), headers=request_headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ApiError(f"Storage upload failed for {path.name}: HTTP {exc.code} {detail[:800]}") from exc


def md_section(text: str, number: int) -> str:
    match = re.search(rf"^##\s+{number}\.\s+[^\n]+\n+(.+?)(?=\n##\s+\d+\.|\Z)", text, re.M | re.S)
    if not match:
        raise ValueError(f"Missing upload-copy section {number}")
    return match.group(1).strip()


def prepare_product(product: dict) -> dict:
    pdf_path = product["folder"] / product["pdf"]
    md_path = product["folder"] / product["upload"]
    preview_dir = product["folder"] / "공개미리보기_4쪽"
    preview_paths = [
        preview_dir / "01_표지.png",
        preview_dir / "02_자료정보.png",
        preview_dir / "03_1일차_읽기.png",
        preview_dir / "04_1일차_기록.png",
    ]
    for path in [pdf_path, md_path, *preview_paths]:
        if not path.is_file():
            raise FileNotFoundError(path)
    reader = PdfReader(str(pdf_path))
    if len(reader.pages) != product["pages"]:
        raise ValueError(f"Page count mismatch: {pdf_path}")
    pdf_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    md_text = md_path.read_text(encoding="utf-8")
    if PRICE_PATTERN.search(pdf_text) or PRICE_PATTERN.search(md_text):
        raise ValueError(f"Price text is not allowed in files: {product['resource_id']}")
    title = md_section(md_text, 1)
    summary = md_section(md_text, 2)
    description = md_section(md_text, 3)
    keywords = [item.strip() for item in md_section(md_text, 4).split(",") if item.strip()]
    material_lines = []
    for line in md_section(md_text, 5).splitlines():
        clean = line.strip()
        if clean.startswith("- "):
            clean = clean[2:].strip()
        if clean:
            material_lines.append(clean)
    if not 3 <= len(keywords) <= 12:
        raise ValueError(f"Keyword count mismatch: {product['resource_id']}")
    if len("\n".join(material_lines)) > 3000:
        raise ValueError(f"Public material text exceeds 3000 chars: {product['resource_id']}")
    required = ["구성 페이지수", "이 기도를 통해 목표하는 부분", "목차", "공개 미리보기"]
    joined = "\n".join(material_lines)
    if any(value not in joined for value in required):
        raise ValueError(f"Public material section is incomplete: {product['resource_id']}")
    prepared = dict(product)
    prepared.update({
        "pdf_path": pdf_path,
        "preview_paths": preview_paths,
        "title": title,
        "summary": summary,
        "description": description,
        "keywords": keywords,
        "preview_items": material_lines,
    })
    return prepared


class SupabaseAdmin:
    def __init__(self, base_url: str, api_key: str, access_token: str):
        self.base_url = base_url
        self.api_key = api_key
        self.access_token = access_token

    @property
    def headers(self):
        return {"apikey": self.api_key, "Authorization": f"Bearer {self.access_token}"}

    def rest(self, method: str, table: str, query: dict | None = None, body=None, *, prefer="return=representation"):
        url = f"{self.base_url}/rest/v1/{table}"
        if query:
            url += "?" + urllib.parse.urlencode(query, safe="(),.*")
        headers = {**self.headers, "Accept-Profile": "public", "Content-Profile": "public"}
        if prefer:
            headers["Prefer"] = prefer
        return request_json(method, url, headers=headers, body=body)

    def rpc(self, function: str, body: dict):
        return request_json("POST", f"{self.base_url}/rest/v1/rpc/{function}", headers={**self.headers, "Content-Profile": "public"}, body=body)

    def upload(self, bucket: str, object_path: str, local_path: Path):
        encoded = urllib.parse.quote(object_path, safe="/")
        return upload_binary(f"{self.base_url}/storage/v1/object/{bucket}/{encoded}", local_path, headers=self.headers)

    def remove_objects(self, bucket: str, object_paths: list[str]):
        if not object_paths:
            return None
        return request_json("DELETE", f"{self.base_url}/storage/v1/object/{bucket}", headers=self.headers, body={"prefixes": object_paths})


def one(rows, context: str):
    if not isinstance(rows, list) or len(rows) != 1:
        raise ApiError(f"Expected one row for {context}, got {len(rows) if isinstance(rows, list) else 'non-list'}")
    return rows[0]


def fetch_snapshot(client: SupabaseAdmin, resource_id: str) -> dict:
    resource = one(client.rest("GET", "faith_resources", {"select": "id,type,title,summary,tags,access_level,status,published,display_order,published_at", "id": f"eq.{resource_id}"}), "resource")
    details = one(client.rest("GET", "faith_resource_private_details", {"select": "resource_id,description,preview_items,gallery_items", "resource_id": f"eq.{resource_id}"}), "details")
    product = one(client.rest("GET", "faith_products", {"select": "id,resource_id,type,title,summary,preview_items,sale_status,price_amount,currency,purchasable,published,marketing_details,base_print_copies,print_pack_size,print_pack_price", "resource_id": f"eq.{resource_id}"}), "product")
    originals = client.rest("GET", "resource_files", {"select": "id,resource_id,bucket_id,object_path,file_name,mime_type,file_size,sort_order", "resource_id": f"eq.{resource_id}", "order": "sort_order.asc"}) or []
    previews = client.rest("GET", "resource_preview_files", {"select": "id,resource_id,bucket_id,object_path,file_name,mime_type,file_size,alt_text,sort_order", "resource_id": f"eq.{resource_id}", "order": "sort_order.asc"}) or []
    if len(originals) != 1 or len(previews) != 3:
        raise ApiError(f"Unexpected pre-registration file counts for {resource_id}: {len(originals)}/{len(previews)}")
    return {"resource": resource, "details": details, "product": product, "originals": originals, "previews": previews}


def login(base_url: str, api_key: str, email: str, password: str) -> tuple[str, dict]:
    response = request_json(
        "POST",
        f"{base_url}/auth/v1/token?grant_type=password",
        headers={"apikey": api_key},
        body={"email": email, "password": password},
    )
    token = response.get("access_token")
    user = response.get("user") or {}
    if not token or not user.get("id"):
        raise ApiError("Supabase sign-in did not return a valid session")
    return token, user


def sign_out(base_url: str, api_key: str, access_token: str):
    try:
        request_json("POST", f"{base_url}/auth/v1/logout?scope=local", headers={"apikey": api_key, "Authorization": f"Bearer {access_token}"}, expected=(200, 204))
    except Exception:
        pass


def rollback(client: SupabaseAdmin, snapshots: dict, new_rows: dict, uploaded: list[tuple[str, str]]):
    for resource_id, row_ids in new_rows.items():
        for table, ids in row_ids.items():
            if ids:
                client.rest("DELETE", table, {"id": f"in.({','.join(ids)})"})
    for resource_id, snapshot in snapshots.items():
        resource_payload = {key: value for key, value in snapshot["resource"].items() if key != "id"}
        details_payload = {key: value for key, value in snapshot["details"].items() if key != "resource_id"}
        product_payload = {key: value for key, value in snapshot["product"].items() if key not in {"id", "resource_id"}}
        client.rest("PATCH", "faith_resources", {"id": f"eq.{resource_id}"}, resource_payload, prefer="return=minimal")
        client.rest("PATCH", "faith_resource_private_details", {"resource_id": f"eq.{resource_id}"}, details_payload)
        client.rest("PATCH", "faith_products", {"resource_id": f"eq.{resource_id}"}, product_payload)
        existing_originals = client.rest("GET", "resource_files", {"select": "id", "resource_id": f"eq.{resource_id}"}) or []
        existing_previews = client.rest("GET", "resource_preview_files", {"select": "id", "resource_id": f"eq.{resource_id}"}) or []
        existing_original_ids = {item["id"] for item in existing_originals}
        existing_preview_ids = {item["id"] for item in existing_previews}
        missing_originals = [item for item in snapshot["originals"] if item["id"] not in existing_original_ids]
        missing_previews = [item for item in snapshot["previews"] if item["id"] not in existing_preview_ids]
        if missing_originals:
            client.rest("POST", "resource_files", body=missing_originals)
        if missing_previews:
            client.rest("POST", "resource_preview_files", body=missing_previews)
    grouped: dict[str, list[str]] = {}
    for bucket, object_path in uploaded:
        grouped.setdefault(bucket, []).append(object_path)
    for bucket, paths in grouped.items():
        client.remove_objects(bucket, paths)


def main() -> None:
    prepared = [prepare_product(product) for product in PRODUCTS]
    print("Local validation passed for 3 products (PDF pages, 4 previews, upload copy, no price text).")
    base_url, api_key = read_config()
    email = input("Admin email: ").strip()
    password = getpass.getpass("Admin password: ")
    access_token = ""
    try:
        access_token, user = login(base_url, api_key, email, password)
        del password
        client = SupabaseAdmin(base_url, api_key, access_token)
        profile = one(client.rest("GET", "profiles", {"select": "id,email,role", "id": f"eq.{user['id']}"}), "admin profile")
        if profile.get("role") != "admin" or str(profile.get("email", "")).casefold() != email.casefold():
            raise ApiError("Authenticated account is not a verified faith-resource admin")
        print("Authenticated administrator verified. No credential or token will be stored.")

        snapshots = {item["resource_id"]: fetch_snapshot(client, item["resource_id"]) for item in prepared}
        batch = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
        uploaded: list[tuple[str, str]] = []
        new_rows = {item["resource_id"]: {"resource_files": [], "resource_preview_files": []} for item in prepared}
        cutover_verified = False
        try:
            for item in prepared:
                resource_id = item["resource_id"]
                original_path = f"{resource_id}/{batch}-original.pdf"
                client.upload("faith-resources", original_path, item["pdf_path"])
                uploaded.append(("faith-resources", original_path))
                item["new_original_path"] = original_path
                item["new_preview_paths"] = []
                for index, preview_path in enumerate(item["preview_paths"], 1):
                    object_path = f"{resource_id}/{batch}-preview-{index}.png"
                    client.upload("faith-resource-previews", object_path, preview_path)
                    uploaded.append(("faith-resource-previews", object_path))
                    item["new_preview_paths"].append(object_path)
            print("Uploaded 3 protected originals and 12 public preview images to new object paths.")

            all_ids = [item["resource_id"] for item in prepared]
            for item in prepared:
                resource_id = item["resource_id"]
                related_ids = [value for value in all_ids if value != resource_id]
                resource_payload = {
                    "title": item["title"], "summary": item["summary"], "tags": item["keywords"],
                    "access_level": item["access_level"], "status": "published", "published": True,
                    "updated_by": user["id"],
                }
                details_payload = {
                    "description": item["description"], "preview_items": item["preview_items"],
                    "gallery_items": [], "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                marketing = {
                    "schemaVersion": 1, "hook": item["hook"], "audiences": item["audiences"],
                    "benefits": item["benefits"], "usageModes": item["usage_modes"],
                    "purchaseGoal": item["purchase_goal"], "pageCount": item["pages"],
                    "dayCount": item["days"], "formats": ["A4 인쇄", "휴대폰 열람"],
                    "relatedResourceIds": related_ids,
                }
                product_payload = {
                    "title": item["title"], "summary": item["summary"], "preview_items": item["preview_items"],
                    "sale_status": item["sale_status"], "price_amount": item["price_amount"], "currency": "KRW",
                    "purchasable": item["purchasable"], "published": True, "marketing_details": marketing,
                    "base_print_copies": 20, "print_pack_size": 10, "print_pack_price": 3000,
                }
                one(client.rest("PATCH", "faith_resources", {"id": f"eq.{resource_id}", "select": "id"}, resource_payload), "resource update")
                one(client.rest("PATCH", "faith_resource_private_details", {"resource_id": f"eq.{resource_id}"}, details_payload), "details update")
                one(client.rest("PATCH", "faith_products", {"resource_id": f"eq.{resource_id}"}, product_payload), "product update")

                # Replace DB links before reusing sort orders; old storage remains intact until verification.
                snapshot = snapshots[resource_id]
                original_ids = [row["id"] for row in snapshot["originals"]]
                preview_ids = [row["id"] for row in snapshot["previews"]]
                deleted_originals = client.rest("DELETE", "resource_files", {"id": f"in.({','.join(original_ids)})"})
                deleted_previews = client.rest("DELETE", "resource_preview_files", {"id": f"in.({','.join(preview_ids)})"})
                if len(deleted_originals or []) != len(original_ids) or len(deleted_previews or []) != len(preview_ids):
                    raise ApiError(f"Old DB file rows were not fully detached for {resource_id}")

                original_row = one(client.rest("POST", "resource_files", body={
                    "resource_id": resource_id, "bucket_id": "faith-resources", "object_path": item["new_original_path"],
                    "file_name": item["pdf_path"].name, "mime_type": "application/pdf",
                    "file_size": item["pdf_path"].stat().st_size, "sort_order": 0,
                }), "new original")
                new_rows[resource_id]["resource_files"].append(original_row["id"])
                preview_payloads = [{
                    "resource_id": resource_id, "bucket_id": "faith-resource-previews", "object_path": object_path,
                    "file_name": preview_path.name, "mime_type": "image/png", "file_size": preview_path.stat().st_size,
                    "alt_text": f"{item['title']} 미리보기 {index}", "sort_order": index - 1,
                } for index, (preview_path, object_path) in enumerate(zip(item["preview_paths"], item["new_preview_paths"]), 1)]
                preview_rows = client.rest("POST", "resource_preview_files", body=preview_payloads)
                if not isinstance(preview_rows, list) or len(preview_rows) != 4:
                    raise ApiError(f"Expected four inserted previews for {resource_id}")
                new_rows[resource_id]["resource_preview_files"].extend(row["id"] for row in preview_rows)

            # The publish RPC now sees exactly one PDF and four previews per product.
            for item in prepared:
                client.rpc("publish_faith_resource", {"p_resource_id": item["resource_id"]})

            results = []
            for item in prepared:
                resource_id = item["resource_id"]
                resource = one(client.rest("GET", "faith_resources", {"select": "id,title,access_level,status,published", "id": f"eq.{resource_id}"}), "verified resource")
                product = one(client.rest("GET", "faith_products", {"select": "id,sale_status,price_amount,purchasable,published,base_print_copies,print_pack_size,print_pack_price,marketing_details", "resource_id": f"eq.{resource_id}"}), "verified product")
                originals = client.rest("GET", "resource_files", {"select": "id,object_path,file_size", "resource_id": f"eq.{resource_id}"}) or []
                previews = client.rest("GET", "resource_preview_files", {"select": "id,object_path,file_size,sort_order", "resource_id": f"eq.{resource_id}", "order": "sort_order.asc"}) or []
                if len(originals) != 1 or len(previews) != 4:
                    raise ApiError(f"Final file counts do not match for {resource_id}")
                if product["sale_status"] != item["sale_status"] or product["price_amount"] != item["price_amount"] or bool(product["purchasable"]) != item["purchasable"]:
                    raise ApiError(f"Final product state does not match for {resource_id}")
                if (product["base_print_copies"], product["print_pack_size"], product["print_pack_price"]) != (20, 10, 3000):
                    raise ApiError(f"Print-license policy mismatch for {resource_id}")
                results.append({
                    "resource_id": resource_id, "title": resource["title"], "access_level": resource["access_level"],
                    "sale_status": product["sale_status"], "price_amount": product["price_amount"],
                    "purchasable": product["purchasable"], "original_count": 1, "preview_count": 4,
                    "base_print_copies": 20, "print_pack_size": 10, "print_pack_price": 3000,
                })

            cutover_verified = True
            cleanup_warnings = []
            for resource_id, snapshot in snapshots.items():
                for bucket, rows in (("faith-resources", snapshot["originals"]), ("faith-resource-previews", snapshot["previews"])):
                    try:
                        client.remove_objects(bucket, [row["object_path"] for row in rows])
                    except Exception as exc:
                        cleanup_warnings.append(f"{resource_id}/{bucket}: {exc}")
            report = {
                "status": "registered_and_verified",
                "registered_at": datetime.now(timezone.utc).isoformat(),
                "products": results,
                "old_storage_cleanup_warnings": cleanup_warnings,
                "credentials_stored": False,
            }
            RESULT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(report, ensure_ascii=False, indent=2))
        except Exception:
            if not cutover_verified:
                try:
                    rollback(client, snapshots, new_rows, uploaded)
                except Exception as rollback_error:
                    print(f"ROLLBACK WARNING: {rollback_error}", file=sys.stderr)
            raise
    finally:
        password = ""
        if access_token:
            sign_out(base_url, api_key, access_token)
        access_token = ""


if __name__ == "__main__":
    main()
