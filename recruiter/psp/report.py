"""Render a shortlist as a self-contained HTML campaign sheet.

Saved locally and opened in Chrome, so every button acts inside the browser
the user is already signed in to: WhatsApp Web opens with the message typed,
mailto: opens Outlook with the mail composed. Nothing is hosted, which
matters - the page carries candidate mobiles and home postcodes and must not
end up behind a URL.

Progress is kept in localStorage so a campaign worked over a day survives a
page reload.
"""
from __future__ import annotations

import html
import json

CSS = """
*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#f6f7f9; --card:#fff; --ink:#14171a; --muted:#5b6570; --line:#e3e6ea;
  --accent:#0b5cff; --wa:#1da851; --wa-ink:#fff; --flag:#b4341c; --flagbg:#fdeeea;
  --chipbg:#eef1f5; --done:#f0f3f6;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#14171a; --card:#1c2024; --ink:#e9edf1; --muted:#98a3ad; --line:#2c3238;
  --accent:#5b9bff; --wa:#1da851; --wa-ink:#fff; --flag:#ff9d86; --flagbg:#3a201a;
  --chipbg:#262c32; --done:#191d21;
}}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:1.6rem;margin:0 0 6px;letter-spacing:-.01em}
.sub{color:var(--muted);margin:0 0 20px}
.meta{background:var(--card);border:1px solid var(--line);border-radius:12px;
  padding:16px 18px;margin:0 0 22px}
.meta dl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:0}
.meta dt{color:var(--muted)} .meta dd{margin:0;font-weight:600}
.warn{border-left:3px solid var(--flag);background:var(--flagbg);color:var(--flag);
  border-radius:8px;padding:12px 16px;margin:0 0 22px}
.warn b{color:inherit}
.tools{position:sticky;top:0;z-index:5;background:var(--bg);padding:12px 0;
  border-bottom:1px solid var(--line);margin-bottom:20px;display:flex;
  gap:10px;flex-wrap:wrap;align-items:center}
input[type=search]{flex:1 1 240px;min-width:0;padding:9px 12px;border-radius:9px;
  border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:15px}
.count{color:var(--muted);font-size:.9rem;white-space:nowrap}
h2{font-size:1.05rem;margin:30px 0 4px;letter-spacing:.01em}
.tiernote{color:var(--muted);margin:0 0 14px;font-size:.92rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;
  padding:16px 18px;margin:0 0 12px}
.card.done{opacity:.5;background:var(--done)}
.top{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
.name{font-weight:650;font-size:1.05rem}
.score{color:var(--muted);font-variant-numeric:tabular-nums;font-size:.9rem}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px}
.chip{background:var(--chipbg);border-radius:6px;padding:3px 8px;font-size:.83rem;
  color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
ul.why{margin:0 0 10px;padding-left:18px} ul.why li{margin:2px 0}
.flag{color:var(--flag);font-weight:600}
.msg{background:var(--chipbg);border-radius:9px;padding:11px 13px;margin:0 0 12px;
  font-size:.92rem;color:var(--muted)}
.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
a.btn,button.btn{display:inline-block;border:1px solid var(--line);border-radius:9px;
  padding:9px 15px;font-size:.92rem;font-weight:600;text-decoration:none;
  background:var(--card);color:var(--ink);cursor:pointer;font-family:inherit}
a.wa{background:var(--wa);border-color:var(--wa);color:var(--wa-ink)}
a.mail{background:var(--accent);border-color:var(--accent);color:#fff}
.btn:hover{filter:brightness(1.06)}
label.done{margin-left:auto;color:var(--muted);font-size:.88rem;
  display:flex;gap:6px;align-items:center;cursor:pointer;white-space:nowrap}
table{width:100%;border-collapse:collapse;font-size:.93rem}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600}
.scroll{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px}
footer{color:var(--muted);font-size:.87rem;margin-top:36px;border-top:1px solid var(--line);padding-top:16px}
@media (max-width:600px){.wrap{padding:18px 14px 60px}.meta dl{grid-template-columns:1fr}}
"""

JS = """
const KEY='psp-done-'+document.body.dataset.job;
const done=new Set(JSON.parse(localStorage.getItem(KEY)||'[]'));
function paint(){
  document.querySelectorAll('.card[data-id]').forEach(c=>{
    const on=done.has(c.dataset.id);
    c.classList.toggle('done',on);
    const b=c.querySelector('input[type=checkbox]'); if(b) b.checked=on;
  });
  const t=document.getElementById('count');
  if(t) t.textContent=done.size+' of '+document.querySelectorAll('.card[data-id]').length+' contacted';
}
document.addEventListener('change',e=>{
  const c=e.target.closest('.card[data-id]'); if(!c||e.target.type!=='checkbox')return;
  e.target.checked?done.add(c.dataset.id):done.delete(c.dataset.id);
  localStorage.setItem(KEY,JSON.stringify([...done])); paint();
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-copy]'); if(!b)return;
  navigator.clipboard.writeText(b.dataset.copy).then(()=>{
    const o=b.textContent; b.textContent='Copied'; setTimeout(()=>b.textContent=o,1200);
  });
});
const box=document.getElementById('q');
if(box) box.addEventListener('input',()=>{
  const q=box.value.toLowerCase();
  document.querySelectorAll('.card[data-id]').forEach(c=>{
    c.style.display=c.dataset.search.includes(q)?'':'none';
  });
  document.querySelectorAll('section').forEach(s=>{
    const any=[...s.querySelectorAll('.card[data-id]')].some(c=>c.style.display!=='none');
    s.style.display=any?'':'none';
  });
});
paint();
"""


def _esc(s) -> str:
    return html.escape(str(s or ""))


def _card(c: dict) -> str:
    parts = [f'<div class="card" data-id="{_esc(c["name"])}" '
             f'data-search="{_esc((c["name"] + " " + (c.get("postcode") or "") + " " + " ".join(c.get("reasons", []))).lower())}">']
    parts.append('<div class="top">'
                 f'<span class="name">{_esc(c["name"])}</span>'
                 f'<span class="score">{c["score"]}/100</span></div>')

    chips = []
    if c.get("phone"):
        chips.append(f'<span class="chip">{_esc(c["phone"])}</span>')
    if c.get("email"):
        chips.append(f'<span class="chip">{_esc(c["email"])}</span>')
    where = c.get("postcode") or ""
    if c.get("miles") is not None:
        where = f'{where} · {c["miles"]:.0f} mi'
    if where.strip(" ·"):
        chips.append(f'<span class="chip">{_esc(where)}</span>')
    parts.append('<div class="chips">' + "".join(chips) + "</div>")

    parts.append("<ul class='why'>")
    for r in c.get("reasons", []):
        parts.append(f"<li>{_esc(r)}</li>")
    for f in c.get("flags", []):
        parts.append(f'<li class="flag">CHECK: {_esc(f)}</li>')
    parts.append("</ul>")

    if c.get("whatsapp_text"):
        parts.append(f'<div class="msg">{_esc(c["whatsapp_text"])}</div>')

    acts = []
    if c.get("whatsapp_web_link"):
        acts.append(f'<a class="btn wa" target="_blank" rel="noopener" '
                    f'href="{_esc(c["whatsapp_web_link"])}">WhatsApp</a>')
        acts.append(f'<a class="btn" target="_blank" rel="noopener" '
                    f'href="{_esc(c["whatsapp_link"])}">Open in app</a>')
    else:
        acts.append('<span class="score">No mobile on file</span>')
    if c.get("mailto_link"):
        acts.append(f'<a class="btn mail" href="{_esc(c["mailto_link"])}">Email draft</a>')
    d = c.get("email_draft") or {}
    if d.get("body"):
        body = (d.get("subject", "") + "\n\n" + d["body"])
        acts.append(f'<button class="btn" data-copy="{_esc(body)}">Copy email</button>')
    acts.append('<label class="done"><input type="checkbox"> Contacted</label>')
    parts.append('<div class="actions">' + "".join(acts) + "</div>")

    parts.append("</div>")
    return "".join(parts)


def render(job: dict, tiers: list[tuple[str, str, list[dict]]],
           extras: list[tuple[str, str]], notes: list[str]) -> str:
    """Build the full page. `tiers` is (heading, note, candidates)."""
    total = sum(len(g) for _, _, g in tiers)
    title = f'{job["client"]} - {job["title"]}'
    h = [f"<title>{_esc(title)}</title>", f"<style>{CSS}</style>",
         f'<div class="wrap" data-job="{_esc(job["client"])}">',
         f"<h1>{_esc(title)}</h1>",
         f'<p class="sub">{total} contactable candidates, ranked. '
         "Open this file in Chrome so the buttons use your signed-in sessions.</p>"]

    h.append('<div class="meta"><dl>')
    for k, v in job.get("facts", []):
        h.append(f"<dt>{_esc(k)}</dt><dd>{_esc(v)}</dd>")
    h.append("</dl></div>")

    for n in notes:
        h.append(f'<div class="warn">{n}</div>')

    h.append('<div class="tools"><input id="q" type="search" '
             'placeholder="Filter by name, postcode or reason">'
             '<span class="count" id="count"></span></div>')

    for heading, note, group in tiers:
        if not group:
            continue
        h.append(f"<section><h2>{_esc(heading)}</h2>"
                 f'<p class="tiernote">{_esc(note)}</p>')
        for c in group:
            h.append(_card(c))
        h.append("</section>")

    if extras:
        h.append("<section><h2>CWD experience in the CV folder - contact details needed</h2>"
                 '<p class="tiernote">Found by reading the formatted CVs. Not in any '
                 "shortlist file, so pull their number from the master list.</p>"
                 '<div class="scroll"><table><thead><tr><th>Candidate</th>'
                 "<th>Why they matter</th></tr></thead><tbody>")
        for name, why in extras:
            h.append(f"<tr><td><b>{_esc(name)}</b></td><td>{_esc(why)}</td></tr>")
        h.append("</tbody></table></div></section>")

    h.append("<footer>Candidate personal data - keep this file local, do not "
             "upload or forward it. Progress is stored in this browser only."
             "<br>Pace WhatsApp sends across the day; bursts and recipient "
             "reports are what get a number banned, not repeated wording.</footer>")
    h.append("</div>")
    h.append(f"<script>{JS}</script>")
    return "\n".join(h)
