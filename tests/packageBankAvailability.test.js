import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const components = ['PackageSelector.vue', 'TopicCheck.vue', 'ExamMode.vue', 'MistakeTrainer.vue']
  .map((file) => readFileSync(new URL('../src/components/' + file, import.meta.url), 'utf8'));

test('all package-dependent modes show the same clear zero-bank notice', () => {
  for (const source of components) {
    assert.match(source, /Keine Paketbanken geladen\./);
    assert.match(source, /Bitte lade zuerst deine private Lernbibliothek\./);
    assert.match(source, /0 von 11 Paketbanken geladen/);
  }
});

test('package-dependent starts are guarded while partial libraries remain supported', () => {
  const [packageSelector, topicCheck, examMode, mistakeTrainer] = components;
  assert.match(packageSelector, /v-if="!loadedPackageCount"/);
  assert.match(topicCheck, /if\(!hasBanks\.value\)return/);
  assert.match(examMode, /if \(!hasBanks\.value\) return/);
  assert.match(mistakeTrainer, /if \(!canTrainMistakes\.value\) return/);
  assert.match(examMode, /\{\{ banks\.length \}\} von 11 Paketbanken verfügbar/);
  assert.match(mistakeTrainer, /unavailableEntries\.length/);
});
