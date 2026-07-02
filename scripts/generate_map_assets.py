import csv
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MAP_DIR = ROOT / "harisonburg-map"
SVG_PATH = MAP_DIR / "harrisonburg_1981_overlay-edited.svg"
IMAGE_PATH = MAP_DIR / "harrisonburg_1981_map.jpg"
OUT_JSON = ROOT / "harrisonburg_1981_hotspots.json"
OUT_CSV = ROOT / "harrisonburg_1981_hotspots.csv"
TILE_DIR = ROOT / "tiles-edited"

SVG_NS = "{http://www.w3.org/2000/svg}"
TOKEN_RE = re.compile(r"[MmLlHhVvCcZz]|-?\d+(?:\.\d+)?")


DESCRIPTIONS = {
    "lincoln-homestead-sign": "A small sign in the upper-left corner labels the Lincoln Homestead, setting off one of the rural history vignettes around the edge of the Harrisonburg scene.",
    "horse-drawn-wagon": "A horse-drawn wagon moves along the upper-left roadway, part of the map's old-time rural imagery and transportation jokes.",
    "red-barn-hillside": "A red barn sits on the hillside near the top of the illustration, marking the agricultural landscape around Harrisonburg and Rockingham County.",
    "fishing-boat-quote": "A small fishing boat gag appears on the water with the caption, \"I don't believe it!\" The joke is one of the tiny comic scenes tucked into the map.",
    "us-route-42-sign": "The U.S. Route 42 marker identifies one of the major roads threading through the illustrated town-and-county landscape.",
    "poultry-festival-animals": "A group of animals stands near the Poultry Festival reference, nodding to the region's poultry industry and festival culture.",
    "udderly-impossible-cow": "A cow-centered visual pun reads as an \"udderly impossible\" gag, one of the map's playful animal jokes.",
    "court-square-village-sign": "A storefront sign identifies Court Square Village, placing the viewer near the downtown commercial core.",
    "eastern-mennonite-college": "This cluster marks Eastern Mennonite College, now Eastern Mennonite University, with campus buildings drawn into the upper-right portion of the map.",
    "hawk-or-eagle-upper-right": "A large bird flies above the Eastern Mennonite College area, functioning as a small visual landmark in the upper-right sky.",
    "blacksmith-or-anvil-gag": "A village blacksmith scene with an anvil appears among the downtown-area vignettes, adding an old-town trade reference and a bit of slapstick.",
    "joseph-neys-building": "A building labeled for Joseph Neys appears in the older village/downtown portion of the illustration.",
    "high-school-statue": "A basketball-player figure or statue stands near the Harrisonburg High School area, calling attention to school spirit and athletics.",
    "bruce-street-house": "The c. 1750 Bruce Street house appears here as one of the historical-house references embedded in the drawing.",
    "saved-by-jmu-character": "A character labeled \"Saved by JMU\" appears as a small joke in the central part of the map, near James Madison University references.",
    "radio-tower": "A radio tower rises above nearby buildings, a thin landmark that is easy to miss unless you scan the skyline carefully.",
    "harrisonburg-baptist-church": "Harrisonburg Baptist Church is shown as a prominent church building in the downtown/civic portion of the illustration.",
    "asbury-united-methodist-church": "Asbury United Methodist Church appears as another labeled church landmark in the central Harrisonburg scene.",
    "harrisonburg-rockingham-historical-society": "The Harrisonburg-Rockingham Historical Society label marks a local history institution among the downtown civic landmarks.",
    "municipal-building": "The Municipal Building appears as a civic landmark near the churches and downtown institutions in the center of the map.",
    "valley-memorial-hospital-sign": "A sign for Valley Memorial Hospital identifies the hospital area before the newer Rockingham Memorial Hospital reference elsewhere on the map.",
    "massanutten-bank-small-branch": "A small Massanutten Bank & Trust branch is shown among the central business and civic landmarks.",
    "valley-civic-center": "The Valley Civic Center storefront appears in the downtown commercial strip, one of several labeled businesses and public venues.",
    "james-madison-university-main-building": "The main James Madison University building is drawn as a major campus landmark, anchoring the JMU portion of the map.",
    "jmu-front-lawn-figures": "Small figures on the James Madison University front lawn add activity and humor to the campus scene.",
    "lowenbrau-truck": "A Löwenbräu truck drives near the JMU and hospital area, one of several delivery vehicles hidden in the illustration.",
    "rockingham-memorial-hospital": "Rockingham Memorial Hospital is labeled with its large hospital complex, one of the key institutional landmarks in the lower half of the map.",
    "hospital-red-construction-area": "A red-earth construction area near Rockingham Memorial Hospital suggests campus or hospital expansion work in progress.",
    "valley-mall": "Valley Mall is shown as a large retail landmark, capturing the commercial growth and shopping culture of Harrisonburg in the early 1980s.",
    "zaggers-sign": "A small Zaggers sign appears near the Valley Mall area, one of the many local business labels scattered through the scene.",
    "cheerleader-at-mall": "A cheerleader figure stands near Valley Mall, adding a bright character detail to the shopping-center vignette.",
    "rooster-lower-left": "A large rooster dominates the lower-left area, a playful nod to poultry and rural Rockingham County identity.",
    "swing-set-purcell-park": "A small swing set in Purcell Park marks a recreational detail in the green park area.",
    "plane-in-park": "A small airplane appears in the Purcell Park area, one of the whimsical objects hidden in the lower-left landscape.",
    "horse-and-bull-gag": "A horse-and-bull scene forms a compact comic gag near the lower-left side of the illustration.",
    "downtown-row-wilson-jewelers": "A downtown storefront row includes Wilson Jewelers and neighboring businesses, representing the dense commercial fabric around Court Square.",
    "jess-quick-lunch": "Jess' Quick Lunch is marked in the downtown row, highlighting a familiar local eatery in the city-center business district.",
    "rockingham-national-bank-storefront": "A Rockingham National Bank storefront appears among the downtown buildings, one of several banking references in the map.",
    "court-house-downtown-building": "A large courthouse-area building anchors the downtown block near Court Square, the flag, and the surrounding storefronts.",
    "american-flag-court-square": "The American flag at Court Square marks the civic center of downtown Harrisonburg and helps orient the viewer in the courthouse area.",
    "confederate-monument": "The Confederate monument is shown at Court Square. The title should be reviewed for present-day interpretive language and historical accuracy.",
    "outfitters-yellow-arch": "A yellow arch marks The Outfitters area, a bright visual cue in the Rolling Hills Shopping Center section.",
    "rolling-hills-shopping-center": "Rolling Hills Shopping Center and The Outfitters are grouped here as a large retail complex along the lower central roadway.",
    "mountain-man-outfitters": "A mountain-man figure near The Outfitters works as an outdoor-store character and a small visual joke.",
    "small-yellow-buggy": "A small yellow buggy sits along the roadway, another transportation detail in the busy shopping-center area.",
    "big-east-market-flower-road": "The East Market Street area is drawn with a flower-like road or interchange shape, a distinctive piece of the map's playful cartography.",
    "us-33-marker": "The U.S. Route 33 marker labels another major road through Harrisonburg, helping connect the picture to real routes.",
    "massanutten-bank-logo": "The Massanutten Bank & Trust logo appears as a large business sign or emblem in the banking district portion of the drawing.",
    "wooden-bank-building": "A wooden bank building is drawn near the cluster of financial institutions, likely a historical or stylized business reference.",
    "red-roof-savings-loan-bottom": "A red-roofed Rockingham Savings & Loan building appears in the lower banking district, near the curved roads and commercial buildings.",
    "parus-associates-copyright": "The Parus & Associates copyright area identifies the mapmaker/publisher credit printed near the lower part of the illustration.",
    "rockingham-national-bank-curved-building": "A curved Rockingham National Bank building anchors part of the lower-right commercial corridor.",
    "valley-national-bank": "Valley National Bank is shown as a labeled bank building in the lower-right business district.",
    "walmart-storefront": "A Walmart storefront appears among the lower-right retail buildings, capturing a recognizable national retailer in the local commercial landscape.",
    "rockingham-national-bank-red-building": "A red Rockingham National Bank building appears near the lower-right banking and retail cluster.",
    "armored-truck": "An armored truck is parked or driving near the bank buildings, a small detail that reinforces the financial-district theme.",
    "rockingham-savings-loan-upper": "Rockingham Savings & Loan appears as an upper building in the lower-right commercial area.",
    "dairy-truck": "A dairy truck is drawn near the lower-right roadway, a local delivery detail tied to the region's food and agriculture economy.",
    "hess-and-miller-sign": "The Hess & Miller Inc. sign labels a business in the lower-right industrial or commercial cluster.",
    "hess-and-miller-building": "The Hess & Miller building sits beside its sign, adding another local business landmark to the lower-right edge.",
    "lite-beer-truck": "A Lite beer truck appears along the lower-right roadway, one of the map's many tiny vehicle and delivery details.",
    "black-bear-trash-bag": "A bear with a trash bag creates a comic scene near the lower-right area, rewarding close looking.",
    "tree-trunk-speech-gag": "A tree-trunk speech gag appears near the lower-right corner, one of the more hidden cartoon captions in the map.",
    "office-building-lower-right-center": "An office building in the lower-right center sits among the banks, stores, and service businesses.",
    "city-seal-of-harrisonburg": "The City Seal of Harrisonburg is printed as an official civic emblem in the lower-right portion of the map.",
    "eagle-under-welcome-sign": "An eagle figure appears under or near the Welcome to Harrisonburg sign, adding a patriotic visual accent.",
    "welcome-to-harrisonburg-sign": "The Welcome to Harrisonburg sign frames the lower-right entrance to the illustrated city scene, with an eagle flying beneath it.",
    "racehorse-rider-scene": "A racehorse and rider scene appears near the bottom edge, another small action vignette in the map's outer band.",
    "spotted-dog-bottom-right": "A spotted dog appears near the bottom-right area, a small animal detail likely meant to catch the viewer's eye.",
    "hunter-bottom-right": "A hunter figure appears near the bottom-right edge, part of a small outdoor or sporting vignette.",
    "cannon-far-right": "A cannon is drawn near the far-right edge, adding a historical or military-reference detail to the outer scene.",
    "sleeping-figure-zs": "A sleeping figure with visible Zs appears near the lower-right area, a quiet cartoon joke tucked among busier scenes.",
    "dalmation-and-turkey-hunter-note": "A note near the bottom center-right appears to mention a Dalmatian and turkey hunter. This label needs local review because the tiny text is difficult to confirm from the source image.",
    "ten-four-turkey-hunter-note": "A small note reads like a CB-radio joke: \"10-4 good buddy... got my sights on Turkeytown!\" The nearby hunter makes the punchline easier to spot.",
    "joseph-neys-street-scene": "This wider downtown street scene includes the Joseph Neys building, nearby pedestrians, and a roadside gag about a large race purse.",
    "us-33-office-and-hunter-gag": "This cluster combines a U.S. Route 33 marker, an office-like building, and the nearby turkey-hunter joke at the edge of town.",
    "cannon-and-hillside-barn": "A cannon sits near a hillside and red barn detail on the far-right edge of the illustration, mixing historic imagery with rural scenery.",
}


def slugify(value):
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "hotspot"


def parse_viewbox(root):
    values = [float(v) for v in root.get("viewBox", "0 0 2047 1726").split()]
    return int(values[2]), int(values[3])


def path_points(d):
    tokens = TOKEN_RE.findall(d or "")
    points = []
    index = 0
    command = None
    current = [0.0, 0.0]
    start = [0.0, 0.0]

    def is_command(value):
        return len(value) == 1 and value.isalpha()

    def read_number():
        nonlocal index
        value = float(tokens[index])
        index += 1
        return value

    while index < len(tokens):
        if is_command(tokens[index]):
            command = tokens[index]
            index += 1
        if command is None:
            break

        lower = command.lower()
        relative = command.islower()

        if lower == "z":
            current = start[:]
            points.append(tuple(current))
            command = None
            continue

        if lower == "m":
            first = True
            while index + 1 < len(tokens) and not is_command(tokens[index]):
                x = read_number()
                y = read_number()
                current = [current[0] + x, current[1] + y] if relative else [x, y]
                points.append(tuple(current))
                if first:
                    start = current[:]
                    first = False
            command = "l" if relative else "L"
            continue

        if lower == "l":
            while index + 1 < len(tokens) and not is_command(tokens[index]):
                x = read_number()
                y = read_number()
                current = [current[0] + x, current[1] + y] if relative else [x, y]
                points.append(tuple(current))
            continue

        if lower == "h":
            while index < len(tokens) and not is_command(tokens[index]):
                x = read_number()
                current[0] = current[0] + x if relative else x
                points.append(tuple(current))
            continue

        if lower == "v":
            while index < len(tokens) and not is_command(tokens[index]):
                y = read_number()
                current[1] = current[1] + y if relative else y
                points.append(tuple(current))
            continue

        if lower == "c":
            while index + 5 < len(tokens) and not is_command(tokens[index]):
                coords = [read_number() for _ in range(6)]
                pairs = list(zip(coords[0::2], coords[1::2]))
                if relative:
                    absolute_pairs = [(current[0] + x, current[1] + y) for x, y in pairs]
                else:
                    absolute_pairs = pairs
                points.extend(absolute_pairs)
                current = [absolute_pairs[-1][0], absolute_pairs[-1][1]]
            continue

        raise ValueError(f"Unsupported SVG path command: {command}")

    return points


def polygon_area(points):
    if len(points) < 3:
        return 0
    return abs(
        sum(
            points[i][0] * points[(i + 1) % len(points)][1]
            - points[(i + 1) % len(points)][0] * points[i][1]
            for i in range(len(points))
        )
        / 2
    )


def centroid(points):
    if not points:
        return [0, 0]
    area2 = 0
    cx = 0
    cy = 0
    for i, point in enumerate(points):
        x0, y0 = point
        x1, y1 = points[(i + 1) % len(points)]
        cross = x0 * y1 - x1 * y0
        area2 += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(area2) < 1e-9:
        return [sum(x for x, _ in points) / len(points), sum(y for _, y in points) / len(points)]
    return [cx / (3 * area2), cy / (3 * area2)]


def crop_box(bbox, image_size):
    x0, y0, x1, y1 = bbox
    width = x1 - x0
    height = y1 - y0
    pad = max(55, int(max(width, height) * 0.32))
    left = max(0, math.floor(x0 - pad))
    top = max(0, math.floor(y0 - pad))
    right = min(image_size[0], math.ceil(x1 + pad))
    bottom = min(image_size[1], math.ceil(y1 + pad))
    return [left, top, right - left, bottom - top]


def make_tile(image, crop, output):
    left, top, width, height = crop
    tile = image.crop((left, top, left + width, top + height))
    tile.thumbnail((560, 420), Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    tile.save(output, "WEBP", quality=86, method=6)


def main():
    root = ET.parse(SVG_PATH).getroot()
    view_width, view_height = parse_viewbox(root)
    image = Image.open(IMAGE_PATH).convert("RGB")
    paths = root.findall(f".//{SVG_NS}g[@id='hotspots']/{SVG_NS}path")
    seen = set()
    rows = []

    for index, path in enumerate(paths, 1):
        title_node = path.find(f"{SVG_NS}title")
        title = (title_node.text or "").strip() if title_node is not None else ""
        raw_id = path.get("data-id") or path.get("id", "").removeprefix("hotspot-") or slugify(title)
        hotspot_id = slugify(raw_id)
        if hotspot_id in seen:
            hotspot_id = f"{hotspot_id}-{index}"
        seen.add(hotspot_id)

        points = path_points(path.get("d"))
        if not points:
            continue
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        bbox = [min(xs), min(ys), max(xs), max(ys)]
        crop = crop_box(bbox, image.size)
        tile = f"tiles-edited/{hotspot_id}.webp"
        make_tile(image, crop, ROOT / tile)

        rows.append(
            {
                "id": hotspot_id,
                "title": title or hotspot_id.replace("-", " ").title(),
                "description": DESCRIPTIONS.get(
                    hotspot_id,
                    "This hotspot marks a small detail in the 1981 Harrisonburg/JMU illustration. The title and description should be reviewed against local knowledge and visitor comments.",
                ),
                "status": "draft",
                "needs_review": hotspot_id not in DESCRIPTIONS,
                "svg_path": re.sub(r"\s+", " ", (path.get("d") or "").strip()),
                "bbox": [round(v, 2) for v in bbox],
                "crop": crop,
                "center": [round(v, 1) for v in centroid(points)],
                "tile": tile,
                "display_area": round(polygon_area(points), 2),
            }
        )

    expected_tiles = {ROOT / row["tile"] for row in rows}
    for tile_path in TILE_DIR.glob("*.webp"):
        if tile_path not in expected_tiles:
            tile_path.unlink()

    payload = {
        "image": {
            "width": view_width,
            "height": view_height,
            "source_copy": "harisonburg-map/harrisonburg_1981_map.jpg",
            "overlay": "harisonburg-map/harrisonburg_1981_overlay-edited.svg",
        },
        "hotspots": rows,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    with OUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "id",
                "title",
                "description",
                "status",
                "needs_review",
                "svg_path",
                "bbox_x",
                "bbox_y",
                "bbox_w",
                "bbox_h",
                "crop_x",
                "crop_y",
                "crop_w",
                "crop_h",
                "center_x",
                "center_y",
                "tile",
                "display_area",
            ],
        )
        writer.writeheader()
        for row in rows:
            x0, y0, x1, y1 = row["bbox"]
            cx, cy = row["center"]
            crop_x, crop_y, crop_w, crop_h = row["crop"]
            writer.writerow(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "description": row["description"],
                    "status": row["status"],
                    "needs_review": row["needs_review"],
                    "svg_path": row["svg_path"],
                    "bbox_x": x0,
                    "bbox_y": y0,
                    "bbox_w": round(x1 - x0, 2),
                    "bbox_h": round(y1 - y0, 2),
                    "crop_x": crop_x,
                    "crop_y": crop_y,
                    "crop_w": crop_w,
                    "crop_h": crop_h,
                    "center_x": cx,
                    "center_y": cy,
                    "tile": row["tile"],
                    "display_area": row["display_area"],
                }
            )

    print(f"Wrote {len(rows)} hotspots, {len(rows)} tiles")


if __name__ == "__main__":
    main()
