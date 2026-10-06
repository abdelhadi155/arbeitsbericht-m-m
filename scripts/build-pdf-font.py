"""
Erzeugt die im PDF eingebettete Schrift aus Liberation Sans (SIL Open Font License 1.1).

Die Schrift wird auf lateinische Zeichen inkl. Osteuropa/Türkei reduziert (kleinere PDFs) und –
wie von der OFL für veränderte Fassungen verlangt – umbenannt („MM Bericht Sans“).
Liberation Sans ist metrisch identisch mit Helvetica/Arial.

Aufruf: pip install fonttools && python3 scripts/build-pdf-font.py
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

SRC = Path("/usr/share/fonts/truetype/liberation")
OUT = Path(__file__).resolve().parent.parent / "public" / "fonts"
UNICODES = (
    list(range(0x20, 0x7F))        # ASCII
    + list(range(0xA0, 0x180))     # Latin-1, Latin Extended-A (ć č š ž ł ő ş ğ ı …)
    + list(range(0x218, 0x21C))    # ș ț (Rumänisch)
    + list(range(0x2010, 0x2027))  # Striche, Anführungszeichen „“ ‚‘, …
    + [0x20AC, 0x2122, 0x2116, 0x00D7, 0x2212]  # € ™ № × −
)
NAME = "MM Bericht Sans"

for style, src in (("Regular", "LiberationSans-Regular.ttf"), ("Bold", "LiberationSans-Bold.ttf")):
    font = TTFont(SRC / src)
    options = subset.Options()
    options.hinting = False
    options.layout_features = ["kern"]
    options.name_IDs = ["*"]
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    for record in font["name"].names:
        if record.nameID in (1, 16):
            record.string = NAME
        elif record.nameID == 4:
            record.string = f"{NAME} {style}"
        elif record.nameID == 6:
            record.string = f"MMBerichtSans-{style}"
        elif record.nameID == 3:
            record.string = f"MMBerichtSans-{style}; subset of Liberation Sans"
    target = OUT / f"MMBerichtSans-{style}.ttf"
    font.save(target)
    print(target.name, target.stat().st_size, "Bytes")
