from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FILES = ["premium-pdf.html", "prayer-pdf-library.html", "prayer-pdf-guide.html", "admin-faith-resources.html"]


class Inspector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.assets = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"])
        attr = "src" if tag in {"img", "script"} else "href" if tag == "link" else None
        if attr and values.get(attr):
            self.assets.append(values[attr])


for name in FILES:
    inspector = Inspector()
    inspector.feed((ROOT / name).read_text(encoding="utf-8"))
    duplicates = sorted({value for value in inspector.ids if inspector.ids.count(value) > 1})
    missing = []
    for value in inspector.assets:
        if value.startswith(("http:", "https:", "//", "#", "data:")):
            continue
        target = ROOT / value.split("?", 1)[0]
        if not target.exists():
            missing.append(value)
    if duplicates or missing:
        raise SystemExit(f"{name}: duplicate_ids={duplicates}, missing_assets={missing}")
    print(f"{name}: ok")

premium_html = (ROOT / "premium-pdf.html").read_text(encoding="utf-8")
library_html = (ROOT / "prayer-pdf-library.html").read_text(encoding="utf-8")

if 'id="faithResourceBrowser"' in premium_html:
    raise SystemExit("premium-pdf.html: resource browser must live on the library page")
if "prayer-pdf-library.html?type=pdf" not in premium_html:
    raise SystemExit("premium-pdf.html: missing prayer PDF library link")

required_library_ids = ["faithResourceBrowser", "faithResourceSearch", "faithResourceTags", "faithResourceList", "cardThreadDetail"]
missing_library_ids = [value for value in required_library_ids if f'id="{value}"' not in library_html]
if missing_library_ids:
    raise SystemExit(f"prayer-pdf-library.html: missing required IDs {missing_library_ids}")
print("prayer PDF page separation: ok")
