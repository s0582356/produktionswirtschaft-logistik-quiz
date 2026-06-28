# Produktionswirtschaft & Logistik Quiz

Eine Vue.js-Lern-App zum Ueben zentraler Konzepte aus Produktionswirtschaft und Logistik mit oeffentlichen Demo-Fragen und lokal importierbaren privaten JSON-Fragebanken.

Live-Demo: noch nicht eingerichtet  
GitHub-Repository: noch nicht eingerichtet

## Funktionen

* Oeffentliche Demo-Fragen zu Produktionswirtschaft und Logistik
* Lokaler Import eigener JSON-Fragebanken
* Kein Backend
* Keine Datenbank
* Kein Login
* Sitzungsbasierter Quiz-Ablauf
* Gemischte Antwortoptionen
* Ergebnisuebersicht
* Wiederholungsmodus fuer falsch beantwortete Fragen
* Serienzaehlung
* Kategorie-Auswertung
* Lernempfehlungen
* Responsives Design

## Oeffentliche Demo-Inhalte

Das oeffentliche Repository enthaelt nur einen kleinen neutralen Demo-Fragensatz. Er behandelt allgemeine Grundlagen aus:

* Logistik-Grundlagen
* ABC-Analyse
* XYZ-Analyse
* Materialbedarf
* Beschaffung
* Lager und Kommissionierung
* Produktionsplanung und -steuerung
* Lean Management
* Industrie 4.0
* Umweltmanagement

Die Demo-Inhalte sind bewusst allgemein formuliert. Sie enthalten keine Namen von Lehrenden, keine institutionsinternen Inhalte, keine privaten Lehrunterlagen, keine pruefungsnahen Hinweise und keine privaten Lernmaterialien.

## Privater JSON-Workflow

Eigene Fragebanken koennen ueber den Dateiauswahldialog lokal geladen werden:

* Private JSON-Dateien bleiben auf dem eigenen Geraet.
* Dateien werden nur lokal im Browser gelesen.
* Dateien werden nicht hochgeladen.
* Dateien werden nicht auf einem Server gespeichert.
* Dateien sind nicht Teil der deployten statischen App.
* Private Ordner wie `private/` und `src/data/private/` bleiben durch `.gitignore` geschuetzt.

So bleibt die App als oeffentliche Demo nachvollziehbar, waehrend private Fragen lokal genutzt werden koennen.

## Tech Stack

* Vue.js
* Vite
* JavaScript
* CSS
* JSON
* Render Static Site

## JSON-Format

Eigene Fragebanken verwenden ein einfaches JSON-Array. Jede Frage enthaelt die Frage, vier Antwortoptionen, die richtige Antwort und eine Erklaerung.

```json
[
  {
    "id": 1,
    "category": "Materialbedarf",
    "difficulty": "custom",
    "question": "Was unterscheidet Bruttobedarf und Nettobedarf?",
    "options": [
      "Bruttobedarf zeigt den Gesamtbedarf vor Bestandsabgleich",
      "Bruttobedarf zeigt den Bedarf nach Bestandsabgleich",
      "Bruttobedarf zeigt nur die Lieferzeit eines Lieferanten",
      "Bruttobedarf zeigt nur Lagerorte im Unternehmen"
    ],
    "correctAnswer": "Bruttobedarf zeigt den Gesamtbedarf vor Bestandsabgleich",
    "explanation": "Der Bruttobedarf beschreibt den gesamten Bedarf vor Beruecksichtigung von Lagerbestand, offenen Bestellungen oder Sicherheitsbestand. Der Nettobedarf ergibt sich erst nach diesem Abgleich."
  }
]
```

Pflichtfelder:

* `question`
* `options` mit mindestens zwei Antworten
* `correctAnswer`, das auch in `options` enthalten sein muss
* `explanation`

Optionale Felder:

* `id`
* `category`
* `difficulty`

Regeln fuer hochwertige Multiple-Choice-Fragen stehen in `QUESTION_QUALITY.md`.

## Lokale Entwicklung

Abhaengigkeiten installieren:

```bash
npm install
```

Entwicklungsserver starten:

```bash
npm run dev
```

Statische App bauen:

```bash
npm run build
```

## Deployment

Die App kann als Render Static Site bereitgestellt werden.

Render-Einstellungen:

* Type: Static Site
* Build Command: `npm install && npm run build`
* Publish Directory: `dist`

## Portfolio-Wert

Das Projekt zeigt die Wiederverwendung einer stabilen Vue-Architektur fuer eine Lern-App im Themenbereich Produktionswirtschaft und Logistik. Es demonstriert die klare Trennung zwischen oeffentlichen Demo-Inhalten und privaten lokalen Fragebanken, JSON-basiertes Content Modeling, Frontend-State-Handling und statisches Deployment ohne Backend, Datenbank oder Benutzerkonten.
