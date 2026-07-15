from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FILES = ["premium-pdf.html", "prayer-pdf-guide.html", "admin-faith-resources.html"]


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
