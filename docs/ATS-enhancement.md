# ATS Enhancement — Future Pro Features

> Research basis: ATS systems (Workday, Greenhouse, Lever, Taleo, iCIMS) filter resumes
> in three gates: (1) parsing, (2) keyword match against the job requisition, (3) formatting
> validation. Jobscan charges $49.95/month for a static upload-and-compare tool.
> JobFit's advantage: already has both resume and job description from Gmail — no manual
> paste needed. Gap prioritization (required/preferred) is already shipped in v0.2.0.

---

## Feature 1 — Contextual keyword rewrites (Pro)

Instead of listing missing keywords, the LLM rewrites existing resume bullet points to
embed them naturally.

**Example:**
- Before: "Analyzed sales data in Excel"
- After: "Analyzed sales data using Power BI dashboards to surface actionable trends"

**Implementation:** prompt addition to `src/analyzer/prompt-builder.ts` `buildPro()`.
Add a `rewrittenBullets` field to the JSON response. Display in `ResultsTab.tsx`
as a collapsible "Suggested rewrites" section.

**Differentiation vs Jobscan:** Jobscan only lists missing keywords — it cannot rewrite.
This is the highest-value differentiator.

---

## Feature 2 — Section naming audit (Pro)

Flag non-standard section headers that ATS parsers miss. Show rename suggestions.

**Common failures:**

| User writes | ATS may miss | Suggest |
|---|---|---|
| Competencies | Taleo, iCIMS | Skills |
| Work History | Workday | Work Experience |
| Education and Certifications | Most | Split into two sections |
| Summary of Qualifications | Greenhouse | Professional Summary |

**Implementation:** add a `sectionAudit` field to the Pro prompt response.
Display as a warning list in `ResultsTab.tsx`.

---

## Feature 3 — Per-ATS formatting advice (Pro)

Detect the ATS platform from the job posting URL already available in Gmail.
Show formatting guidance specific to that platform.

**URL-to-ATS mapping** (add to `src/config.ts`):

```ts
export const ATS_URL_MAP: Record<string, string> = {
  'greenhouse.io':       'Greenhouse',
  'lever.co':            'Lever',
  'myworkdayjobs.com':   'Workday',
  'taleo.net':           'Taleo',
  'icims.com':           'iCIMS',
};
```

**Per-ATS advice:**
- **Greenhouse**: two-column PDF layouts fail parsing — use single-column DOCX
- **Taleo**: strict keyword rules; avoid tables and text boxes; use plain text sections
- **Workday**: DOCX parses at 97% vs PDF at 83% — always submit DOCX
- **Lever**: modern NLP parser; formatting less critical; focus on keyword coverage
- **iCIMS**: avoid headers/footers; plain text preferred

**Implementation:** no LLM call needed — pure lookup. Show as a tip card in
`ResultsTab.tsx` when `job.urls[0]` matches a known ATS domain.

---

## Feature 4 — ATS pass probability score (Pro)

Show a second score badge alongside the existing match score:
`ATS Pass Likelihood: 72%`

Calculated from:
- Keyword coverage of required terms (from gap prioritization already shipped)
- Formatting compliance (from section audit)
- Section completeness (Skills, Experience, Education present)

**Implementation:** computed client-side from existing parsed data — no extra LLM call.
Add `atsScore` field to `AnalysisResult`. Show in `ResultsTab.tsx` next to `ScoreBadge`.

---

## Implementation order (when ready)

1. Feature 3 (per-ATS advice) — pure lookup, zero LLM cost, easiest
2. Feature 4 (ATS score) — computed from existing data, no new API calls
3. Feature 1 (keyword rewrites) — highest value, needs prompt change + UI
4. Feature 2 (section audit) — needs prompt change, moderate UI work
