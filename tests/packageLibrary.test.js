import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { addPackageBanks, readPackageBankFiles } from '../src/utils/packageLibrary.js'

function bank(packageNumber, questionCount = 3) {
  const packageId = `p${String(packageNumber).padStart(2, '0')}`
  const questions = Array.from({ length: questionCount }, (_, index) => {
    const questionType = ['mc', 'yesNo', 'freeText'][index % 3]
    if (questionType === 'mc') return { questionId: `${packageId}-${index}`, questionType, question: 'Synthetische MC-Frage', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'Synthetisch.' }
    if (questionType === 'yesNo') return { questionId: `${packageId}-${index}`, questionType, statement: 'Synthetische Aussage', correctAnswer: true, explanation: 'Synthetisch.' }
    return { questionId: `${packageId}-${index}`, questionType, question: 'Synthetische Freitextfrage', modelAnswer: 'Synthetische Musterlösung', checkpoints: ['synthetisch'] }
  })
  return { type: 'package', schemaVersion: 1, packageId, packageTitle: `Synthetisches Paket ${packageNumber}`, packageNumber, questions }
}
function file(name, value) { return { name, text: async () => typeof value === 'string' ? value : JSON.stringify(value) } }

test('Paketbibliothek: eine Paketbank wird ihrer packageId zugeordnet', async () => {
  const result = await readPackageBankFiles([file('p01.json', bank(1))])
  const library = addPackageBanks({}, result.banks)
  assert.equal(result.errors.length, 0)
  assert.equal(library.p01.packageTitle, 'Synthetisches Paket 1')
  assert.deepEqual(library.p01.counts, { total: 3, mc: 1, yesNo: 1, freeText: 1 })
})

test('Paketbibliothek: p01 und p02 werden gleichzeitig getrennt geladen', async () => {
  const result = await readPackageBankFiles([file('p01.json', bank(1)), file('p02.json', bank(2))])
  const library = addPackageBanks({}, result.banks)
  assert.deepEqual(Object.keys(library).sort(), ['p01', 'p02'])
  assert.notEqual(library.p01.questions, library.p02.questions)
})

test('Paketbibliothek: erneuter Import ersetzt nur dieselbe packageId', async () => {
  const initial = addPackageBanks({}, (await readPackageBankFiles([file('p01-old.json', bank(1, 3)), file('p02.json', bank(2, 3))])).banks)
  const replaced = addPackageBanks(initial, (await readPackageBankFiles([file('p01-new.json', bank(1, 6))])).banks)
  assert.equal(replaced.p01.counts.total, 6)
  assert.equal(replaced.p02.counts.total, 3)
})

test('Paketbibliothek: elf synthetische Paketbanken werden gleichzeitig geladen', async () => {
  const files = Array.from({ length: 11 }, (_, index) => file(`p${index + 1}.json`, bank(index + 1)))
  const result = await readPackageBankFiles(files)
  const library = addPackageBanks({}, result.banks)
  assert.equal(Object.keys(library).length, 11)
  assert.equal(library.p11.packageNumber, 11)
})

test('Paketbibliothek: ungültige Datei verhindert gültige Nachbarn nicht und meldet Dateiname plus Grund', async () => {
  const result = await readPackageBankFiles([file('p01.json', bank(1)), file('defekt.json', '{not-json'), file('p02.json', bank(2))])
  const library = addPackageBanks({}, result.banks)
  assert.deepEqual(Object.keys(library).sort(), ['p01', 'p02'])
  assert.equal(result.errors[0].fileName, 'defekt.json')
  assert.ok(result.errors[0].reason.length > 0)
})

test('Paketbibliothek: doppelte packageId innerhalb eines Imports verwendet die letzte gültige Datei', async () => {
  const result = await readPackageBankFiles([file('p01-old.json', bank(1, 3)), file('p01-new.json', bank(1, 6))])
  const library = addPackageBanks({}, result.banks)
  assert.deepEqual(result.duplicates, ['p01'])
  assert.equal(library.p01.counts.total, 6)
})


test('Paketbibliothek: App wählt die Trainerbank per packageId und erhält sie über den zentralen Import', async () => {
  const [app, importer] = await Promise.all([
    readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/PrivateQuestionImporter.vue', import.meta.url), 'utf8'),
  ])
  assert.match(app, /activePackageId\.value \? packageBanksById\.value\[activePackageId\.value\]/)
  assert.match(app, /@library-loaded="handlePrivateLibraryImport"/)
  assert.match(importer, /async function handleFileChange/)
  assert.doesNotMatch(importer, /handlePackageFilesChange|JSON-Fragen auswählen|Paketbanken auswählen/)
})
