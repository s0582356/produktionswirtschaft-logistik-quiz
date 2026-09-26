# Produktionswirtschaft & Logistik Quiz

Version **0.5.3**

A responsive Vue/Vite learning app for practicing production management and logistics concepts. The public version combines neutral multiple-choice examples with a browser-only workflow for personal JSON question banks.

## Features

- Neutral public multiple-choice demo questions
- Multiple-choice quiz with shuffled answers, score, streaks, category insights, and wrong-answer review
- Local import of custom JSON question banks through the browser
- Automatic detection of multiple-choice, free-text, and method-trainer banks
- Free-text training with local checkpoint-based feedback
- Methods training with nine public demo methods covering calculations and qualitative classification
- Step-by-step feedback with green, yellow, and red status
- Private exam-preparation path (package training, topic check, exam mode, and mistake review) for locally imported package question banks
- **Master-Lernmentor**: a private, chapter-by-chapter deep-learning mode for a personal "Master" script, with open free-text self-assessment and no hard scoring (see below)
- Optional voice input through the browser's speech-recognition capability
- Light and dark themes since version 0.4.2
- Theme selection stored locally in the browser
- Responsive layout for desktop and mobile use

The **Methoden-Training** mode practices calculation and application methods through compact explanations, formulas, intermediate inputs, and worked solutions. Version 0.5.3 includes nine public demo methods:

1. ABC-Analyse
2. Stücklistenauflösung / Mengenstückliste
3. Monatliche Bedarfsverteilung
4. XYZ-Analyse + ABC/XYZ-Matrix (qualitative)
5. Sourcing-Kostenvergleich
6. Fertigungstiefe
7. Verkehrsträger-Vergleich
8. Transportkonzepte-Zuordnung
9. Routenplanung / Tourenplanung (concept and tour-type assignment)

Each method contains three synthetic tasks: 27 tasks in total. The “Verkehr & Transport” module uses closed comparison and assignment fields; route planning trains terminology without calculations.

The app runs as a static application entirely in the browser, without a backend, database, account, external API, or AI service. Complete free-text answers are not persisted.

## Public Demo Content

The repository contains only a small set of neutral example questions covering general production management and logistics concepts. It does not contain private study materials, examination content, internal institutional information, or private sources.

Personal learning materials and private question banks remain outside GitHub and the deployed Render site.

## Local JSON Workflow

Custom question banks are selected with the browser file picker and processed locally:

- Files stay on the user's device.
- Nothing is uploaded to a server.
- Multiple-choice, free-text, and method-trainer formats are detected automatically.
- Imported content is available only for the current browser session.
- Personal question banks are not bundled with the public application.

### Multiple-choice format

```json
[
  {
    "id": 1,
    "category": "Material planning",
    "difficulty": "custom",
    "question": "Which value describes demand before available stock is considered?",
    "options": ["Gross requirements", "Net requirements", "Safety stock", "Reorder point"],
    "correctAnswer": "Gross requirements",
    "explanation": "Gross requirements describe total demand before stock and scheduled receipts are considered."
  }
]
```

Required fields are `question`, `options`, `correctAnswer`, and `explanation`. The correct answer must appear in `options`. The fields `id`, `category`, and `difficulty` are optional.

### Free-text format

```json
[
  {
    "id": "free-1",
    "category": "Logistics",
    "difficulty": "custom",
    "question": "Explain the purpose of inventory management.",
    "keywords": ["availability", "cost"],
    "checkpoints": [
      {
        "label": "Availability",
        "keywords": ["availability", "supply"]
      }
    ],
    "modelAnswer": "Inventory management balances reliable material availability with storage and capital costs.",
    "typicalErrors": ["Considering only storage capacity"]
  }
]
```

Free-text answers are evaluated locally against the supplied checkpoints. This deterministic training aid uses no backend, API, or AI.

### Method-trainer format

Method banks use `type` or `bankType` set to `methodTrainer` and a `methods[]` list. Each method contains a supported engine, explanation, steps, and tasks. Private method banks can be selected locally and stay outside the repository and deployment. The public demo tasks are entirely synthetic.

## Master-Lernmentor

*"Den kompletten PWL-Master, Kapitel für Kapitel – verstehen und in eigenen Worten beherrschen."*

Master-Lernmentor is a separate, private study mode for working through a complete personal "Master" script chapter by chapter, in the reader's own words, rather than answering closed multiple-choice questions. It is its own area on the home screen, next to the public quiz, free-text training, methods training, and the private exam-preparation path — no existing mode is replaced.

A currently supported private Master-Lernmentor file contains:

- 14 chapters, organized into 120 topics
- 291 open, free-text questions in total, including 10 calculation questions with a structured worked-solution panel

**Learning flow per topic:**

1. The topic's master section ("Masterabschnitt") is shown first, so the underlying material is read before any question.
2. "Jetzt abfragen" ("Start now") switches to the question flow for that topic.
3. Each question is answered in the learner's own words in a free-text field — there are no multiple-choice options here.
4. "Lösung vergleichen" ("Compare solution") reveals, in order: a local, deterministic learning hint (see below), a short model answer, a minimum-sufficient answer, the core concepts (and, where present, optional/supplementary concepts shown separately), and finally a short excerpt from the master script — the excerpt is intentionally shown only at this point, not alongside the question, so it cannot give the answer away in advance.
5. A self-rating — 🟢 Confident, 🟡 Partially, or 🔴 Still learning — is recorded, and the learner moves on to the next question or topic.

**No hard scoring.** Master-Lernmentor does not compute a score, a grade, a pass/fail result, or an exam-style verdict. The local feedback is phrased as a learning hint (for example, "many core points recognized" or "compare your answer with the model answer"), never as "correct"/"incorrect". Wording does not have to match the model answer verbatim — the local check tolerates equivalent phrasing.

**Source-gap notices.** For the small number of points where the underlying master script deliberately limits its own depth (for example, no formula is given), the question shows a neutral, low-key notice explaining that the master itself does not go further here — the app never invents or adds external content to fill such a gap.

**Calculation questions.** The 10 calculation questions stay in the same open learning flow as every other question. After revealing the solution, a structured panel shows only the fields that are actually present in the data (formula, calculation steps, a worked example, interpretation notes, and a common-error hint) — nothing is invented for questions that do not include these fields.

**Progress and resume.** The current chapter, topic, question position, and the self-rating recorded for each question are remembered locally, so learning can continue at the same point later. Re-importing the exact same private file offers to continue where the learner left off; a different file, or a changed version of the same file, is treated as a different learning state and never resumes into it — this is based on a content fingerprint of the imported file, not on its file name alone.

### Private import and privacy

Master-Lernmentor reads its own private local JSON file (for example `PWL_MASTER_LERNMENTOR_FINAL.json`) through a dedicated file picker inside the Master-Lernmentor area — this is separate from the general private-library picker described above. This file is not part of this Git repository and not part of the deployed application.

- The imported content is held only in the browser's memory for the current session.
- After a page reload, the file is gone from memory and must be selected again.
- Only technical progress metadata is stored locally to support "Continue": a library identifier, a content fingerprint, the file name, the current chapter/topic/question position, and the self-rating per question.
- **Never stored:** the private question bank itself, question text, master content, master excerpts, model/short answers, core or optional concept text, or the learner's own free-text answers. Only the technical fields above are written to local storage.
- A file that does not match the expected Master-Lernmentor structure and identifier is rejected with a clear message; it is never accepted just because its shape happens to look similar.

**Using it on a smartphone.** The private JSON file can be moved to the device beforehand — for example through the user's own cloud storage or another file-transfer method of their choice — and then selected locally through the file picker, exactly as on desktop. The app itself does not upload or synchronize the private library to any cloud service.

## Voice Input

On supported browsers, free-text answers can optionally be dictated using the browser's built-in speech recognition. Keyboard input remains available at all times. Speech-recognition availability and permissions depend on the browser.

## Light and Dark Themes

Version 0.5.1 includes a light/dark theme switch for all app areas. The selected theme is stored in the browser so it remains active on the next visit. If no choice has been saved yet, the app can use the operating system's preferred color scheme.

## Tech Stack

- Vue.js
- Vite
- JavaScript
- CSS
- JSON
- Render Static Site

## Local Development

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Deployment

The public app is deployed as a static site on Render.

- Type: Static Site
- Build command: `npm install && npm run build`
- Publish directory: `dist`

No server-side infrastructure is required.

## Portfolio Value

The project demonstrates a frontend-only learning application with several complementary training modes, local file processing, deterministic free-text feedback, optional browser capabilities, persistent theme preferences, responsive UI design, and a clear separation between public demo content and personal learning material.
