"""Postcode geography for commute scoring.

The master candidate list stores an outward code only (e.g. "SE18", "AB1"),
so distance is resolved at postcode-AREA level - the alphabetic prefix. That
is accurate to roughly 10-20 miles outside London and is deliberately coarse:
it answers "could this person get there?" not "how long is the drive?".

To upgrade to true district-level accuracy, drop an ONS postcode centroid CSV
at data/postcode_districts.csv (columns: district,lat,lon) and load_districts()
will prefer it automatically.
"""
from __future__ import annotations

import csv
import math
import os
import re

# Approximate centroid of each UK postcode area.
AREA_CENTROIDS: dict[str, tuple[float, float]] = {
    "AB": (57.15, -2.11), "AL": (51.75, -0.34), "B": (52.48, -1.90),
    "BA": (51.38, -2.36), "BB": (53.75, -2.48), "BD": (53.79, -1.75),
    "BH": (50.72, -1.88), "BL": (53.58, -2.43), "BN": (50.83, -0.14),
    "BR": (51.40, 0.02), "BS": (51.45, -2.59), "BT": (54.60, -5.93),
    "CA": (54.89, -2.94), "CB": (52.21, 0.12), "CF": (51.48, -3.18),
    "CH": (53.19, -2.89), "CM": (51.73, 0.48), "CO": (51.89, 0.90),
    "CR": (51.37, -0.10), "CT": (51.28, 1.08), "CV": (52.41, -1.51),
    "CW": (53.10, -2.44), "DA": (51.44, 0.22), "DD": (56.46, -2.97),
    "DE": (52.92, -1.48), "DG": (55.07, -3.60), "DH": (54.78, -1.58),
    "DL": (54.53, -1.55), "DN": (53.52, -1.13), "DT": (50.71, -2.44),
    "DY": (52.51, -2.09), "E": (51.53, -0.05), "EC": (51.52, -0.09),
    "EH": (55.95, -3.19), "EN": (51.65, -0.08), "EX": (50.72, -3.53),
    "FK": (56.00, -3.78), "FY": (53.82, -3.05), "G": (55.86, -4.25),
    "GL": (51.86, -2.24), "GU": (51.24, -0.57), "GY": (49.45, -2.58),
    "HA": (51.58, -0.34), "HD": (53.65, -1.78), "HG": (53.99, -1.54),
    "HP": (51.75, -0.47), "HR": (52.06, -2.72), "HS": (57.90, -6.80),
    "HU": (53.74, -0.34), "HX": (53.72, -1.86), "IG": (51.56, 0.07),
    "IM": (54.15, -4.48), "IP": (52.06, 1.16), "IV": (57.48, -4.22),
    "JE": (49.21, -2.13), "KA": (55.61, -4.50), "KT": (51.41, -0.30),
    "KW": (58.98, -2.96), "KY": (56.11, -3.16), "L": (53.41, -2.98),
    "LA": (54.05, -2.80), "LD": (52.24, -3.38), "LE": (52.64, -1.13),
    "LL": (53.32, -3.83), "LN": (53.23, -0.54), "LS": (53.80, -1.55),
    "LU": (51.88, -0.42), "M": (53.48, -2.24), "ME": (51.39, 0.52),
    "MK": (52.04, -0.76), "ML": (55.79, -3.99), "N": (51.56, -0.11),
    "NE": (54.98, -1.61), "NG": (52.95, -1.15), "NN": (52.24, -0.90),
    "NP": (51.59, -3.00), "NR": (52.63, 1.30), "NW": (51.55, -0.20),
    "OL": (53.54, -2.12), "OX": (51.75, -1.26), "PA": (55.85, -4.42),
    "PE": (52.57, -0.24), "PH": (56.40, -3.44), "PL": (50.38, -4.14),
    "PO": (50.80, -1.09), "PR": (53.76, -2.70), "RG": (51.46, -0.97),
    "RH": (51.24, -0.17), "RM": (51.58, 0.18), "S": (53.38, -1.47),
    "SA": (51.62, -3.94), "SE": (51.47, -0.05), "SG": (51.90, -0.20),
    "SK": (53.41, -2.16), "SL": (51.51, -0.59), "SM": (51.36, -0.19),
    "SN": (51.56, -1.78), "SO": (50.90, -1.40), "SP": (51.07, -1.79),
    "SR": (54.90, -1.38), "SS": (51.54, 0.71), "ST": (53.00, -2.18),
    "SW": (51.46, -0.17), "SY": (52.71, -2.75), "TA": (51.02, -3.10),
    "TD": (55.61, -2.81), "TF": (52.68, -2.45), "TN": (51.19, 0.28),
    "TQ": (50.46, -3.53), "TR": (50.26, -5.05), "TS": (54.57, -1.23),
    "TW": (51.45, -0.34), "UB": (51.55, -0.45), "W": (51.51, -0.20),
    "WA": (53.39, -2.60), "WC": (51.52, -0.12), "WD": (51.66, -0.40),
    "WF": (53.68, -1.50), "WN": (53.54, -2.63), "WR": (52.19, -2.22),
    "WS": (52.59, -1.98), "WV": (52.59, -2.13), "YO": (53.96, -1.08),
    "ZE": (60.15, -1.15),
}

_DISTRICTS: dict[str, tuple[float, float]] | None = None
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def load_districts() -> dict[str, tuple[float, float]]:
    """Load optional district-level centroids; empty dict when unavailable."""
    global _DISTRICTS
    if _DISTRICTS is None:
        _DISTRICTS = {}
        path = os.path.join(_DATA_DIR, "postcode_districts.csv")
        if os.path.exists(path):
            with open(path, newline="", encoding="utf-8") as fh:
                for row in csv.DictReader(fh):
                    try:
                        _DISTRICTS[row["district"].upper().replace(" ", "")] = (
                            float(row["lat"]), float(row["lon"]))
                    except (KeyError, ValueError):
                        continue
    return _DISTRICTS


def outward(postcode: str | None) -> str | None:
    """Extract the outward code (SE18, AB1, M1) from any postcode format."""
    if not postcode:
        return None
    cleaned = re.sub(r"[^A-Z0-9]", "", str(postcode).upper())
    m = re.match(r"^([A-Z]{1,2}\d{1,2}[A-Z]?)", cleaned)
    return m.group(1) if m else None


def area(postcode: str | None) -> str | None:
    """Extract the alphabetic postcode area (SE, AB, M)."""
    out = outward(postcode)
    if not out:
        return None
    m = re.match(r"^([A-Z]{1,2})", out)
    return m.group(1) if m else None


def coords(postcode: str | None) -> tuple[float, float] | None:
    """Best available coordinates: district centroid if loaded, else area."""
    out = outward(postcode)
    if out:
        district = load_districts().get(out)
        if district:
            return district
    a = area(postcode)
    return AREA_CENTROIDS.get(a) if a else None


def miles_between(a: str | None, b: str | None) -> float | None:
    """Great-circle miles between two postcodes, or None if either is unknown."""
    ca, cb = coords(a), coords(b)
    if not ca or not cb:
        return None
    lat1, lon1 = math.radians(ca[0]), math.radians(ca[1])
    lat2, lon2 = math.radians(cb[0]), math.radians(cb[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(h))


# Bands are generous at the top end because social workers routinely commute
# further for a permanent contract than they would for agency work.
def commute_band(miles: float | None) -> tuple[str, float, str]:
    """Map distance to (band, score 0..1, phrase for the shortlist writeup)."""
    if miles is None:
        return "unknown", 0.4, "location not on file"
    # Same postcode area resolves to a distance of ~0, which reads as a bug
    # rather than as "they live there". Say so in words instead.
    if miles <= 3:
        return "local", 1.0, "right on the doorstep"
    if miles <= 12:
        return "local", 1.0, f"local - about {miles:.0f} miles out"
    if miles <= 25:
        return "easy", 0.9, f"easy commute, about {miles:.0f} miles"
    if miles <= 40:
        return "commutable", 0.7, f"commutable at about {miles:.0f} miles"
    if miles <= 60:
        return "stretch", 0.4, f"a stretch at about {miles:.0f} miles - check appetite"
    if miles <= 120:
        return "relocation", 0.15, f"about {miles:.0f} miles - relocation conversation"
    return "far", 0.0, f"about {miles:.0f} miles away - relocation only"
