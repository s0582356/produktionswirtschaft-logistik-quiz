import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { readPrivateLibraryFiles } from '../src/utils/privateLibraryImport.js'
import { addPackageBanks } from '../src/utils/packageLibrary.js'

function file(name, value, webkitRelativePath = '') { return { name, webkitRelativePath, text: async () => typeof value === 'string' ? value : JSON.stringify(value) } }
function mc() { return [{ question: 'MC?', options: ['A', 'B'], correctAnswer: 'A', explanation: 'Begründung' }] }
function free() { return [{ question: 'Freitext?', modelAnswer: 'Antwort', checkpoints: ['antwort'] }] }
function pkg(number, count = 1) {
  const id = 'p' + String(number).padStart(2, '0')
  return { type: 'package', schemaVersion: 1, packageId: id, packageNumber: number, packageTitle: 'Aktives Paket ' + number, questions: Array.from({ length: count }, (_, index) => ({ questionId: id + '-mc-' + index, questionType: 'mc', question: 'Aktive Frage', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'Begründung' })) }
}

test('gemeinsamer Bibliotheksimport ordnet MC, Freitext und Paketbanken zu', async () => {
  const result = await readPrivateLibraryFiles([file('mc.json', mc()), file('free.json', free()), file('p01.json', pkg(1)), file('p02.json', pkg(2))])
  assert.equal(result.errors.length, 0)
  assert.equal(result.mc.questions.length, 1)
  assert.equal(result.freeText.questions.length, 1)
  assert.deepEqual(result.packages.map((entry) => entry.bank.packageId), ['p01', 'p02'])
  assert.deepEqual(Object.keys(addPackageBanks({}, result.packages)).sort(), ['p01', 'p02'])
})

test('fachlicher Begriff synthetisch macht eine aktive Bank nicht zur Demo', async () => {
  const activeMc = [{ question: 'Was ist synthetisches Vorgehen?', options: ['A', 'B'], correctAnswer: 'A', explanation: 'Der Fachbegriff synthetisch ist regulärer Lerninhalt.' }]
  const result = await readPrivateLibraryFiles([file('aktive-mc.json', activeMc)])
  assert.equal(result.skipped.length, 0)
  assert.equal(result.errors.length, 0)
  assert.equal(result.mc.questions.length, 1)
})

test('identische Einzelbanken werden nur einmal geladen und unbekanntes JSON gemeldet', async () => {
  const result = await readPrivateLibraryFiles([file('free-a.json', free()), file('free-b.json', free()), file('unbekannt.json', { hello: 'world' })])
  assert.equal(result.freeText.questions.length, 1)
  assert.equal(result.duplicates.length, 1)
  assert.equal(result.errors.length, 1)
})

test('aktive Paketbanken bleiben getrennt, p01 ersetzt nur p01 und Archivpfade werden ignoriert', async () => {
  const result = await readPrivateLibraryFiles([file('p01-alt.json', pkg(1, 1)), file('p02.json', pkg(2, 1)), file('p01-neu.json', pkg(1, 2)), file('old.json', pkg(3), '99_archiv/old.json'), file('qa.json', pkg(4), '04_pruefungsvorbereitung_paketbanken/qa/qa.json')])
  const library = addPackageBanks({}, result.packages)
  assert.equal(library.p01.counts.total, 2)
  assert.equal(library.p02.counts.total, 1)
  assert.equal(library.p03, undefined)
  assert.equal(library.p04, undefined)
  assert.equal(result.skipped.length, 2)
})

test('elf Paketbanken werden in einem mobilen Multi-Datei-Import akzeptiert', async () => {
  const result = await readPrivateLibraryFiles(Array.from({ length: 11 }, (_, index) => file('p' + (index + 1) + '.json', pkg(index + 1))))
  assert.equal(result.packages.length, 11)
  assert.equal(Object.keys(addPackageBanks({}, result.packages)).length, 11)
})

test('zentrale Importoberfläche nutzt einen normalen JSON-Multi-Datei-Input ohne Directory-Pflicht', () => {
  const importer = readFileSync(new URL('../src/components/PrivateQuestionImporter.vue', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  const style = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  assert.match(importer, /type="file" multiple accept="\.json,application\/json"/)
  assert.doesNotMatch(importer, /webkitdirectory|directory/)
  assert.doesNotMatch(importer, /JSON-Fragen auswählen|Paketbanken auswählen/)
  assert.match(app, /@library-loaded="handlePrivateLibraryImport"/)
  assert.equal((app.match(/<PrivateQuestionImporter/g) || []).length, 1)
  assert.match(style, /@media \(max-width: 560px\) \{[\s\S]*?\.private-library-status/)
})
