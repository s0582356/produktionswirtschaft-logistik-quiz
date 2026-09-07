# Produktionswirtschaft & Logistik Quiz

A responsive Vue/Vite learning app for practicing production management and logistics concepts. The public version combines neutral multiple-choice examples with a browser-only workflow for personal JSON question banks.

## Features

- Neutral public multiple-choice demo questions
- Multiple-choice quiz with shuffled answers, score, streaks, category insights, and wrong-answer review
- Local import of custom JSON question banks through the browser
- Automatic detection of multiple-choice, free-text, and method-trainer banks
- Free-text training with local checkpoint-based feedback
- Methods training for ABC analysis, multi-level bills of materials, and monthly demand distribution
- Step-by-step numerical feedback with green, yellow, and red status
- Optional voice input through the browser's speech-recognition capability
- Light and dark themes since version 0.4.2
- Theme selection stored locally in the browser
- Responsive layout for desktop and mobile use

The new **Methoden-Training** mode practices calculation and application methods through compact explanations, formulas, intermediate inputs, and worked solutions.

The app runs entirely in the browser. It does not require a backend, database, account, external API, or AI service.

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

## Voice Input

On supported browsers, free-text answers can optionally be dictated using the browser's built-in speech recognition. Keyboard input remains available at all times. Speech-recognition availability and permissions depend on the browser.

## Light and Dark Themes

Version 0.5.0 includes a light/dark theme switch for all app areas. The selected theme is stored in the browser so it remains active on the next visit. If no choice has been saved yet, the app can use the operating system's preferred color scheme.

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

The project demonstrates a frontend-only learning application with three training modes, local file processing, deterministic free-text feedback, optional browser capabilities, persistent theme preferences, responsive UI design, and a clear separation between public demo content and personal learning material.
