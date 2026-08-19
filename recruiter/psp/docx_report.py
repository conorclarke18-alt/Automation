"""Render a shortlist as a Word document with working hyperlinks.

Markdown links do not survive every viewer, so the campaign sheet ships as a
.docx: Word and Outlook both render real hyperlinks, and clicking one opens
the system default browser - Chrome, already signed in to WhatsApp Web.

Two link types per candidate:
  * WhatsApp -> web.whatsapp.com/send, which lands in the browser session
    rather than bouncing through the wa.me interstitial.
  * Email    -> mailto:, which opens Outlook with the message composed and
    unsent. Same end state as a draft, without needing Mail.ReadWrite.
"""
from __future__ import annotations

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

INK = RGBColor(0x1A, 0x1A, 0x1A)
MUTED = RGBColor(0x60, 0x6A, 0x74)
LINKBLUE = RGBColor(0x05, 0x63, 0xC1)
WAGREEN = RGBColor(0x0E, 0x7A, 0x3C)
FLAG = RGBColor(0xB4, 0x34, 0x1C)


def add_hyperlink(paragraph, url: str, text: str, color: RGBColor = LINKBLUE,
                  bold: bool = False, size: int = 10):
    """Insert a real w:hyperlink so Word treats it as clickable."""
    r_id = paragraph.part.relate_to(url, RT.HYPERLINK, is_external=True)
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), r_id)
    run = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")

    c = OxmlElement("w:color")
    c.set(qn("w:val"), f"{color:06X}" if isinstance(color, int) else str(color))
    rPr.append(c)
    u = OxmlElement("w:u")
    u.set(qn("w:val"), "single")
    rPr.append(u)
    if bold:
        rPr.append(OxmlElement("w:b"))
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), str(size * 2))
    rPr.append(sz)

    run.append(rPr)
    t = OxmlElement("w:t")
    t.text = text
    t.set(qn("xml:space"), "preserve")
    run.append(t)
    link.append(run)
    paragraph._p.append(link)
    return link


def _p(doc, text="", size=10, bold=False, color=INK, space_after=2, italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    if text:
        r = p.add_run(text)
        r.font.size = Pt(size)
        r.bold = bold
        r.italic = italic
        r.font.color.rgb = color
    return p


def build(path: str, job: dict, tiers: list, extras: list, notes: list) -> str:
    doc = Document()
    for s in doc.sections:
        s.left_margin = s.right_margin = Pt(40)
        s.top_margin = s.bottom_margin = Pt(36)
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = Pt(10)

    total = sum(len(g) for _, _, g in tiers)
    _p(doc, f'{job["client"]} — {job["title"]}', size=17, bold=True, space_after=2)
    _p(doc, f"{total} contactable candidates, ranked. Click a WhatsApp link to open "
            "WhatsApp Web in your browser with the message already written.",
       size=10, color=MUTED, space_after=10)

    for k, v in job.get("facts", []):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(1)
        r = p.add_run(f"{k}: ")
        r.font.size = Pt(10)
        r.font.color.rgb = MUTED
        r2 = p.add_run(str(v))
        r2.font.size = Pt(10)
        r2.bold = True
    _p(doc, space_after=8)

    for n in notes:
        _p(doc, n, size=10, color=FLAG, bold=True, space_after=8)

    for heading, note, group in tiers:
        if not group:
            continue
        _p(doc, heading, size=13, bold=True, space_after=1)
        _p(doc, note, size=9.5, color=MUTED, italic=True, space_after=8)

        for c in group:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(c["name"])
            r.bold = True
            r.font.size = Pt(11.5)
            r2 = p.add_run(f'   {c["score"]}/100')
            r2.font.size = Pt(9)
            r2.font.color.rgb = MUTED

            bits = [c.get("phone") or "no phone", c.get("email") or "no email"]
            where = c.get("postcode") or ""
            if c.get("miles") is not None:
                where = f'{where} · {c["miles"]:.0f} mi'
            if where.strip(" ·"):
                bits.append(where)
            _p(doc, "  |  ".join(bits), size=9, color=MUTED, space_after=3)

            for reason in c.get("reasons", []):
                b = doc.add_paragraph(style="List Bullet")
                b.paragraph_format.space_after = Pt(0)
                rr = b.add_run(reason)
                rr.font.size = Pt(9.5)
            for f in c.get("flags", []):
                b = doc.add_paragraph(style="List Bullet")
                b.paragraph_format.space_after = Pt(0)
                rr = b.add_run(f"CHECK: {f}")
                rr.font.size = Pt(9.5)
                rr.bold = True
                rr.font.color.rgb = FLAG

            if c.get("whatsapp_text"):
                q = doc.add_paragraph()
                q.paragraph_format.space_before = Pt(3)
                q.paragraph_format.space_after = Pt(2)
                q.paragraph_format.left_indent = Pt(14)
                rr = q.add_run(f'"{c["whatsapp_text"]}"')
                rr.font.size = Pt(9)
                rr.italic = True
                rr.font.color.rgb = MUTED

            links = doc.add_paragraph()
            links.paragraph_format.space_after = Pt(12)
            if c.get("whatsapp_web_link"):
                add_hyperlink(links, c["whatsapp_web_link"],
                              "▶ SEND WHATSAPP", WAGREEN, bold=True, size=10)
                sep = links.add_run("      ")
                sep.font.size = Pt(10)
                add_hyperlink(links, c["whatsapp_link"], "open in app instead",
                              MUTED, size=9)
            else:
                rr = links.add_run("No mobile on file — email only")
                rr.font.size = Pt(9)
                rr.font.color.rgb = MUTED
            if c.get("mailto_link"):
                sep = links.add_run("      ")
                sep.font.size = Pt(10)
                add_hyperlink(links, c["mailto_link"], "✉ OPEN EMAIL",
                              LINKBLUE, bold=True, size=10)

    if extras:
        doc.add_page_break()
        _p(doc, "CWD experience found in the CV folder — contact details needed",
           size=13, bold=True, space_after=1)
        _p(doc, "Read out of the formatted CVs. Not in any shortlist file, so pull "
                "their number from the master list.", size=9.5, color=MUTED,
           italic=True, space_after=8)
        t = doc.add_table(rows=1, cols=2)
        t.style = "Light Grid Accent 1"
        hdr = t.rows[0].cells
        hdr[0].text = "Candidate"
        hdr[1].text = "Why they matter"
        for name, why in extras:
            row = t.add_row().cells
            row[0].text = name
            row[1].text = why
        for row in t.rows:
            for cell in row.cells:
                for par in cell.paragraphs:
                    for run in par.runs:
                        run.font.size = Pt(9)

    _p(doc, space_after=6)
    foot = doc.add_paragraph()
    foot.alignment = WD_ALIGN_PARAGRAPH.LEFT
    fr = foot.add_run(
        "Candidate personal data — keep this file internal. Pace WhatsApp sends "
        "across the day: bursts and recipient reports are what get a number "
        "banned, not repeated wording.")
    fr.font.size = Pt(8.5)
    fr.font.color.rgb = MUTED

    doc.save(path)
    return path
