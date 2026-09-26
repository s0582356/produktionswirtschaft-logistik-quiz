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
* Freitext-Training mit lokaler, checkpunktbasierter Rueckmeldung (Gruen/Gelb/Rot)
* Methoden-Training mit oeffentlichen Demo-Methoden zu Berechnungs- und Anwendungsverfahren
* Private Pruefungsvorbereitung (Pakettraining, Themengebiet-Check, Klausurmodus, Fehlertraining) fuer lokal importierte Paket-Fragebanken
* **Master-Lernmentor**: ein privater, kapitelweiser Vertiefungsmodus fuer ein eigenes „Master"-Skript mit offener Freitext-Selbsteinschaetzung ohne harte Bewertung (siehe unten)
* Optionale Spracheingabe ueber die Spracherkennung des Browsers
* Hell- und Dunkelmodus, lokal gespeicherte Themenwahl
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

## Master-Lernmentor

*„Den kompletten PWL-Master, Kapitel fuer Kapitel – verstehen und in eigenen Worten beherrschen."*

Master-Lernmentor ist ein eigener, privater Lernbereich, um ein vollstaendiges persoenliches „Master"-Skript kapitelweise in eigenen Worten zu durchdringen, statt geschlossene Multiple-Choice-Fragen zu beantworten. Er ist ein eigenstaendiger Bereich auf der Startseite, gleichrangig neben dem oeffentlichen Quiz, dem Freitext-Training, dem Methoden-Training und der privaten Pruefungsvorbereitung – kein bestehender Modus wird ersetzt.

Eine aktuell unterstuetzte private Master-Lernmentor-Datei enthaelt:

* 14 Kapitel, unterteilt in 120 Themen
* 291 offene Freitextfragen insgesamt, davon 10 Rechenfragen mit strukturiertem Loesungsweg-Panel

**Lernablauf pro Thema:**

1. Zuerst wird der Masterabschnitt des Themas angezeigt, damit der zugrunde liegende Inhalt vor jeder Frage gelesen wird.
2. „Jetzt abfragen" wechselt in den Fragenfluss dieses Themas.
3. Jede Frage wird in einem Freitextfeld in eigenen Worten beantwortet – es gibt hier keine Auswahloptionen.
4. „Loesung vergleichen" deckt der Reihe nach auf: einen lokalen, deterministischen Lernhinweis (siehe unten), eine kurze Musterantwort, eine minimal ausreichende Antwort, die Kernbegriffe (sowie, falls vorhanden, optionale Ergaenzungen getrennt davon) und zuletzt einen kurzen Master-Auszug – der Auszug wird bewusst erst an dieser Stelle gezeigt, nicht schon bei der Frage, damit er die Antwort nicht vorwegnimmt.
5. Eine Selbsteinschaetzung – 🟢 Sicher, 🟡 Teilweise, 🔴 Noch lernen – wird gespeichert, danach geht es zur naechsten Frage bzw. zum naechsten Thema.

**Kein hartes Scoring.** Master-Lernmentor berechnet weder Punktzahl noch Schulnote noch ein Bestanden/Nicht-bestanden- oder Pruefungsergebnis. Die lokale Rueckmeldung ist als Lernhinweis formuliert (zum Beispiel „viele zentrale Punkte erkannt" oder „vergleiche deine Antwort mit der Musterloesung"), nie als „richtig"/„falsch". Die Formulierung muss nicht wortgleich mit der Musterantwort sein – die lokale Pruefung toleriert gleichwertige Formulierungen.

**Quellenhinweise.** Fuer die wenigen Punkte, an denen der zugrunde liegende Master die eigene inhaltliche Tiefe bewusst begrenzt (zum Beispiel keine Formel nennt), zeigt die Frage einen zurueckhaltenden Hinweis, dass der Master selbst hier nicht weiter ins Detail geht – die App ergaenzt an dieser Stelle nie eigenstaendig externe Inhalte.

**Rechenfragen.** Die 10 Rechenfragen laufen im gleichen offenen Lernfluss wie alle anderen Fragen. Nach dem Aufdecken der Loesung zeigt ein strukturiertes Panel ausschliesslich die tatsaechlich vorhandenen Felder (Formel, Rechenschritte, Beispielrechnung, Interpretation und ein Hinweis auf einen typischen Fehler) – fuer Fragen ohne diese Felder wird nichts erfunden.

**Fortschritt und Fortsetzen.** Das aktuelle Kapitel, Thema, die Frageposition und die Selbsteinschaetzung je Frage werden lokal gemerkt, damit spaeter an derselben Stelle weitergelernt werden kann. Wird genau dieselbe private Datei erneut importiert, bietet die App an, dort fortzusetzen; eine andere Datei oder eine veraenderte Version derselben Bank wird als eigener Lernstand behandelt und setzt dort niemals faelschlich fort – Grundlage dafuer ist ein inhaltlicher Fingerabdruck der importierten Datei, nicht nur ihr Dateiname.

### Privater Import und Datenschutz

Master-Lernmentor liest eine eigene private lokale JSON-Datei (zum Beispiel `PWL_MASTER_LERNMENTOR_FINAL.json`) ueber einen eigenen Dateiauswahldialog innerhalb des Master-Lernmentor-Bereichs ein – getrennt vom allgemeinen Import weiter oben. Diese Datei ist nicht Teil dieses Git-Repositories und nicht Teil der deployten Anwendung.

* Der importierte Inhalt wird nur im Arbeitsspeicher des Browsers fuer die aktuelle Sitzung gehalten.
* Nach einem Neuladen der Seite ist die Datei aus dem Speicher verschwunden und muss erneut ausgewaehlt werden.
* Lokal gespeichert werden ausschliesslich technische Fortschrittsdaten fuer „Fortsetzen": eine Bibliothekskennung, ein inhaltlicher Fingerabdruck, der Dateiname, die aktuelle Kapitel-/Themen-/Fragenposition sowie die Selbsteinschaetzung je Frage.
* **Niemals gespeichert:** die private Fragenbank selbst, Fragetexte, Masterinhalte, Master-Auszuege, Muster-/Kurzantworten, Kernbegriffs- oder Zusatztexte sowie die eigene Freitextantwort der lernenden Person. Es werden ausschliesslich die oben genannten technischen Felder abgelegt.
* Eine Datei, die nicht der erwarteten Master-Lernmentor-Struktur und -Kennung entspricht, wird mit einer klaren Meldung abgelehnt – sie wird niemals allein deshalb akzeptiert, weil ihre Form aehnlich aussieht.

**Nutzung auf dem Smartphone.** Die private JSON-Datei kann vorab auf das Geraet gebracht werden – zum Beispiel ueber den eigenen Cloud-Speicher oder einen anderen selbst gewaehlten Dateitransfer – und anschliessend genau wie am Desktop lokal ueber den Dateiauswahldialog ausgewaehlt werden. Die App selbst laedt die private Bibliothek nicht in einen Cloud-Dienst hoch und synchronisiert sie nicht.

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

Das Projekt zeigt die Wiederverwendung einer stabilen Vue-Architektur fuer eine Lern-App im Themenbereich Produktionswirtschaft und Logistik mit mehreren einander ergaenzenden Trainingsmodi – von geschlossenen Multiple-Choice-Fragen bis zum offenen, kapitelweisen Selbsteinschaetzungs-Lernmodus Master-Lernmentor. Es demonstriert die klare Trennung zwischen oeffentlichen Demo-Inhalten und privaten lokalen Fragebanken, JSON-basiertes Content Modeling, Frontend-State-Handling und statisches Deployment ohne Backend, Datenbank oder Benutzerkonten.
