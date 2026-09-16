import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('Startseite gruppiert alle sieben bestehenden Modus-Klickziele', () => {
  const navigation = appSource.match(/<nav class=\"mode-switcher\"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(navigation, 'Mode-Navigation ist vorhanden');

  assert.match(navigation, /Allgemeines Training/);
  assert.match(navigation, /Prüfungsvorbereitung/);
  assert.match(navigation, /Dein Lernpfad mit den privaten Paketbanken/);

  const modes = [...navigation.matchAll(/@click=\"switchMode\('([^']+)'\)\"/g)].map((match) => match[1]);
  assert.deepEqual(modes.sort(), ['exam', 'freeText', 'mc', 'method', 'mistakes', 'packages', 'topics']);

  for (const label of [
    'Einzelne Themen lernen und festigen',
    'Alle Themenbereiche gezielt kontrollieren',
    'Gemischte Prüfungssimulation ohne Sofortfeedback',
    'Fehler aus Pakettraining, Themengebiet-Check und Klausurmodus wiederholen',
  ]) {
    assert.match(navigation, new RegExp(label));
  }
});

test('Startseiten-Gruppierung bleibt auf Mobilgeräten einspaltig', () => {
  assert.match(styleSource, /\.mode-group-buttons-general,\s*\n\s*\.mode-group-buttons-exam \{ grid-template-columns: 1fr; \}/);
  assert.match(styleSource, /\.mode-group-buttons-general \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
  assert.match(styleSource, /\.mode-group-buttons-exam \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
});
