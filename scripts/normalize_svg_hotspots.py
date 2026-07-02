import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SVG_PATH = ROOT / "harisonburg-map" / "harrisonburg_1981_overlay-edited.svg"


RENAMES_BY_POSITION = {
    55: ("welcome-to-harrisonburg-sign", "Welcome to Harrisonburg sign and eagle"),
    61: ("ten-four-turkey-hunter-note", "“10-4 good buddy” turkey hunter note"),
    62: ("joseph-neys-street-scene", "Joseph Neys street scene"),
    63: ("us-33-office-and-hunter-gag", "U.S. 33 office and hunter gag"),
    64: ("cannon-and-hillside-barn", "Cannon and hillside barn"),
}


PATH_RE = re.compile(r"(<path\b.*?</path>)", re.DOTALL)
TITLE_RE = re.compile(r"(<title\b[^>]*>)(.*?)(</title>)", re.DOTALL)


def set_attr(block, name, value):
    escaped = value.replace('"', "&quot;")
    attr_re = re.compile(rf'\s{name}="[^"]*"')
    if attr_re.search(block):
        return attr_re.sub(f'\n      {name}="{escaped}"', block, count=1)
    return block.replace("<path", f'<path\n      {name}="{escaped}"', 1)


def normalize_block(block, index):
    rename = RENAMES_BY_POSITION.get(index)
    if not rename:
        title_match = TITLE_RE.search(block)
        if not title_match:
            return block
        title = re.sub(r"\s+", " ", title_match.group(2)).strip()
        data_id = re.search(r'data-id="([^"]+)"', block)
        raw_id = data_id.group(1) if data_id else re.search(r'id="hotspot-([^"]+)"', block).group(1)
        hotspot_id = raw_id
    else:
        hotspot_id, title = rename
        block = TITLE_RE.sub(lambda m: f"{m.group(1)}{title}{m.group(3)}", block, count=1)

    block = set_attr(block, "id", f"hotspot-{hotspot_id}")
    block = set_attr(block, "class", "hotspot")
    block = set_attr(block, "tabindex", "0")
    block = set_attr(block, "role", "button")
    block = set_attr(block, "aria-label", title)
    block = set_attr(block, "data-id", hotspot_id)
    block = set_attr(block, "data-title", title)
    return block


def main():
    text = SVG_PATH.read_text(encoding="utf-8")
    count = 0

    def replace(match):
        nonlocal count
        count += 1
        return normalize_block(match.group(1), count)

    updated = PATH_RE.sub(replace, text)
    if count != 64:
        raise SystemExit(f"Expected 64 hotspot paths; found {count}")
    SVG_PATH.write_text(updated, encoding="utf-8")
    print("Normalized 64 hotspot path blocks")


if __name__ == "__main__":
    main()
