# Produktionswirtschaft & Logistik Quiz

Vue.js learning app for practicing production management and logistics concepts with public demo questions and local private JSON question banks.

Live demo: not configured yet  
GitHub repository: not configured yet

## Features

* Public demo questions for production management and logistics
* Local JSON question import for private question banks
* No backend
* No database
* No login
* Session-based quiz flow
* Shuffled answer options
* Result summary
* Wrong-answer review mode
* Streak tracking
* Category insights
* Learning recommendations
* Responsive design

## Public Demo Content

The public repository contains only a small neutral demo question set. It covers general concepts such as:

* Logistics fundamentals
* ABC analysis
* XYZ analysis
* Material requirements
* Procurement
* Warehousing and picking
* Production planning and control
* Lean management
* Industry 4.0
* Environmental management

The demo content is intentionally generic. It does not contain professor names, university-internal material, private lecture notes, exam hints, or private study documents.

## Private JSON Workflow

The app supports private question banks through the browser file picker:

* Private JSON files stay on the user's device.
* Files are read locally in the browser.
* Files are not uploaded.
* Files are not stored on a server.
* Files are not included in the deployed static site.
* Private folders such as `private/` and `src/data/private/` are ignored by Git.

This keeps the public demo app reviewable while still allowing private local practice with personally created JSON files.

## Tech Stack

* Vue.js
* Vite
* JavaScript
* CSS
* JSON
* Render Static Site

## JSON Question Format

Custom question banks use a simple JSON array. Each question contains the prompt, four answer options, the correct answer, and an explanation.

```json
[
  {
    "id": 1,
    "category": "Materialbedarf",
    "difficulty": "custom",
    "question": "What distinguishes gross requirements from net requirements?",
    "options": [
      "Gross requirements show total demand before stock is considered",
      "Gross requirements show demand after stock and receipts",
      "Gross requirements show only supplier lead times",
      "Gross requirements show only warehouse locations"
    ],
    "correctAnswer": "Gross requirements show total demand before stock is considered",
    "explanation": "Gross requirements describe total demand before inventory, scheduled receipts, or safety stock are considered. Net requirements are calculated after these factors are included."
  }
]
```

Required fields:

* `question`
* `options` with at least two answers
* `correctAnswer`, which must also appear in `options`
* `explanation`

Optional fields:

* `id`
* `category`
* `difficulty`

For high-quality multiple-choice questions, see `QUESTION_QUALITY.md`.

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the static app:

```bash
npm run build
```

## Deployment

The app can be deployed as a Render Static Site.

Render settings:

* Type: Static Site
* Build Command: `npm install && npm run build`
* Publish Directory: `dist`

## Portfolio Value

This project demonstrates a reusable Vue learning-app architecture for a production management and logistics topic area. It shows a clean separation between public demo content and private local question banks, JSON-based content modeling, frontend-only quiz state, and static deployment without backend infrastructure, database operations, or user accounts.
