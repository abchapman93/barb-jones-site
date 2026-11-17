"""Build data.js from source/barb.json (public sources gathered 2026-11-17).

Tags each paper with site topics by keyword rules, marks first/last-author papers,
and writes the profile text. Usage: python3 build-data.py
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
src = json.loads((HERE / "source/barb.json").read_text())

TOPICS = [
    ("dx", "Diagnosis & uncertainty",
     "How clinicians diagnose pneumonia, where diagnoses disagree, and how to measure diagnostic performance."),
    ("cds", "Clinical decision support",
     "Electronic tools that screen, score severity and guide admission and treatment for pneumonia in the ED."),
    ("abx", "Antibiotics & resistance",
     "Empiric antibiotic choice, MRSA and Pseudomonas coverage, prescribing variation and stewardship."),
    ("guide", "Guidelines & quality",
     "Practice guidelines for community- and hospital-acquired pneumonia and how to improve care against them."),
    ("hap", "Hospital-acquired pneumonia",
     "Surveillance, incidence and prevention of non-ventilator hospital-acquired pneumonia."),
    ("inf", "Informatics & NLP",
     "Using EHR data, natural language processing and machine learning to study and support care."),
    ("covid", "COVID-19",
     "Outcomes and care of veterans with COVID-19, and the pandemic's effect on pneumonia care."),
    ("out", "Severity & outcomes",
     "Severity, triage, admission decisions and outcomes for patients with pneumonia and lung disease."),
]
RULES = [
    ("dx", r"diagnos|uncertain|discordan|gestalt|bronchoscopy|multiplex|panel"),
    ("cds", r"decision support|\bcds\b|screening tool|curb|admission criteria|electronic screening"),
    ("abx", r"antibiotic|antimicrobial|mrsa|methicillin|pseudomonas|stewardship|de-escalation|prescrib|drug-resistant|resistant"),
    ("guide", r"guideline|official american thoracic|workshop|quality improvement|quality measure|controversy|misinformation|position statement|reply to"),
    ("hap", r"hospital-acquired|ventilator|nosocomial|oral care"),
    ("inf", r"natural language|\bnlp\b|electronic health record|machine learning|language model|topic model|linguistic|informatic|\behr\b|interoperable|electronic versus manual|icd-10"),
    ("covid", r"covid|sars-cov|pandemic"),
    ("out", r"mortality|severity|outcome|admission|icu|triage|trends|incidence|pleural|altitude|air pollution|homeless|aspiration|post-?infectious|immunocompromised|host"),
]


def topics_for(title):
    t = title.lower()
    out = [tid for tid, pat in RULES if re.search(pat, t)]
    return out or ["out"]


pubs = [{
    "title": p["title"], "authors": p["authors"], "year": p["year"], "venue": p["venue"],
    "citations": p.get("citations"), "url": p.get("url") or "", "topics": topics_for(p["title"]),
    "lead": p["author_position"] in ("first", "last"),
} for p in src["papers"]]
pubs.sort(key=lambda p: (-p["year"], -(p["citations"] or 0)))


def years(g):
    a, b = g["years"].split("-")
    return a if a == b else f"{a}\u2013{b}"


grants = [{
    "title": g["title"], "years": years(g),
    "funder": f'{g["funder"]} {g["number"]}'.strip(), "role": g["role"],
} for g in src["grants"]]

# Research timeline: grants plus the most-cited paper from each stretch of years.
career = [{"kind": "grant", "start": int(g["years"][:4]), "end": int(g["years"][-4:]),
           "title": g["title"], "where": f'{g["funder"]} \u00b7 {g["role"]}'} for g in src["grants"]]
for lo, hi in [(2009, 2012), (2013, 2016), (2017, 2019), (2020, 2022), (2023, 2026)]:
    ps = [p for p in pubs if lo <= p["year"] <= hi and p["citations"] and p["lead"]]
    if ps:
        top = max(ps, key=lambda p: p["citations"])
        career.append({"kind": "paper", "start": top["year"], "end": top["year"], "title": top["title"],
                       "where": f'{top["venue"]} \u00b7 {top["citations"]:,} citations'})

oa = src["openalex"]
pubmed = "https://pubmed.ncbi.nlm.nih.gov/?term=Jones+BE%5BAuthor%5D+AND+%28Utah%5BAffiliation%5D+OR+Salt+Lake%5BAffiliation%5D%29"
profile = {
    "name": "Barbara E. Jones, MD, MSCI",
    "kicker": "Pulmonary & critical care \u00b7 Pneumonia",
    "lede": "Pulmonary and critical care physician studying how clinicians diagnose and treat pneumonia, "
            "and how informatics can make that care better.",
    "roles": [
        "Division of Pulmonary, Critical Care and Occupational Pulmonary Medicine, University of Utah",
        "Investigator, VA Salt Lake City Health Care System",
        "Lead author, 2025 ATS Clinical Practice Guideline for Community-acquired Pneumonia",
    ],
    "links": [
        {"label": "ORCID", "url": oa["orcid"]},
        {"label": "OpenAlex", "url": oa["profile_url"]},
        {"label": "PubMed", "url": pubmed},
    ],
    "stats": [
        {"value": f'{sum(p["citations"] or 0 for p in pubs):,}', "label": "citations"},
        {"value": str(oa["h_index"]), "label": "h-index"},
        {"value": f'{len(pubs)}+', "label": "publications"},
        {"value": str(len(src["grants"])), "label": "grants as PI"},
    ],
    "bio": [
        "Barbara Jones is a pulmonary and critical care physician at the University of Utah and the "
        "VA Salt Lake City Health Care System. Her research combines population analytics, qualitative "
        "study of clinician reasoning, and clinical decision support to improve the diagnosis and "
        "treatment of pneumonia.",
        "Her early work with Intermountain Healthcare helped build and test an electronic decision support "
        "tool for emergency department patients with pneumonia, including an electronic CURB-65 severity score "
        "and admission criteria.",
        "With a VA HSR&D Career Development Award she studied decision-making in pneumonia across the VA: "
        "variation in antibiotic prescribing, empiric MRSA and Pseudomonas coverage, and diagnostic "
        "discordance between the emergency department and discharge. Her current VA-funded work studies how "
        "pandemic-era practice changes can inform evidence-based pneumonia care, and a Gordon and Betty Moore "
        "Foundation grant supports measures of diagnostic performance.",
        "She was lead author of the 2025 American Thoracic Society guideline for the diagnosis and management "
        "of community-acquired pneumonia.",
    ],
    "contact": [
        "Division of Pulmonary, Critical Care and Occupational Pulmonary Medicine<br>"
        "Department of Internal Medicine, University of Utah, Salt Lake City, UT",
    ],
    "footer": "Draft built from public sources (OpenAlex, ORCID, PubMed, NIH RePORTER, University of Utah news), "
              "November 2026. Citation counts are OpenAlex's. Paper list and topic tags are a first pass.",
    "reviewer": "alec.chapman@hsc.utah.edu",
}

out = "// Generated by build-data.py from source/barb.json. Do not edit by hand.\n"
for name, val in [("PROFILE", profile), ("TOPICS", [{"id": i, "label": l, "blurb": b} for i, l, b in TOPICS]),
                  ("PUBS", pubs), ("GRANTS", grants), ("CAREER", career)]:
    out += f"window.{name} = {json.dumps(val, ensure_ascii=False, indent=1)};\n"
(HERE / "data.js").write_text(out)
print(len(pubs), "papers;", sum(p["lead"] for p in pubs), "lead;", len(career), "timeline items")
for t, *_ in TOPICS:
    print(" ", t, sum(t in p["topics"] for p in pubs))
