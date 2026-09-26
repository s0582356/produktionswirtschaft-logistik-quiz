import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createTopicCheck } from '../src/utils/topicCheckLogic.js'
import { createInitialTopicCheck, createTopicCheckKey, loadTopicCheck, saveTopicCheck } from '../src/utils/topicCheckStore.js'
const storage=new Map(); global.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}}; afterEach(()=>storage.clear())
function library(count=11){return Object.fromEntries(Array.from({length:count},(_,i)=>{const n=i+1,id=`p${String(n).padStart(2,'0')}`;return [id,{packageId:id,packageNumber:n,packageTitle:`Thema ${n}`,questions:Array.from({length:4},(_,j)=>({questionId:`${id}-${j}`,questionType:['mc','yesNo','freeText','mc'][j],question:'synthetisch'}))}]}))}
function rnd(values){let i=0;return()=>values[i++%values.length]}
for(const size of [1,2,3]) test(`Themencheck: ${size} Frage(n) je Paket und komplette Coverage`,()=>{const l=library();const c=createTopicCheck(l,size,rnd([.2,.8,.4]));assert.equal(c.orderedQuestionRefs.length,11*size);assert.equal(new Set(c.orderedQuestionRefs.map(r=>r.packageId)).size,11);assert.equal(new Set(c.orderedQuestionRefs.map(r=>`${r.packageId}:${r.questionId}`)).size,11*size)})
test('Themencheck: Teilmenge mit fünf Paketen liefert 5/10/15 ohne Duplikate',()=>{for(const size of [1,2,3])assert.equal(createTopicCheck(library(5),size,()=>.3).orderedQuestionRefs.length,5*size)})
test('Themencheck: paketübergreifende Reihenfolge und Fragetypen werden gemischt',()=>{const l=library(5);const c=createTopicCheck(l,3,rnd([.1,.7,.4,.9]));assert.ok(c.orderedQuestionRefs.slice(1).some((r,i)=>r.packageId!==c.orderedQuestionRefs[i].packageId));const types=c.orderedQuestionRefs.map(r=>l[r.packageId].questions.find(q=>q.questionId===r.questionId).questionType);assert.equal(new Set(types).size,3)})
test('Themencheck: Resume bewahrt identische Referenzen, Statistik und keine Fragenobjekte',()=>{const l=library(3),round=createTopicCheck(l,2,()=>.4),session={...createInitialTopicCheck(l),...round,currentQuestionIndex:2,answers:{'p01::p01-0':{questionType:'mc',selectedAnswer:'A',correct:true}},statistics:{correct:1,wrong:0,green:0,yellow:0,red:0}};saveTopicCheck(l,session);const loaded=loadTopicCheck(l);assert.deepEqual(loaded.orderedQuestionRefs,round.orderedQuestionRefs);assert.equal(loaded.statistics.correct,1);const raw=storage.get(createTopicCheckKey(l));assert.equal(raw.includes('synthetisch'),false);assert.equal(raw.includes('questions'),false)})
test('Themencheck: Neustart mit neuer Zufallsfolge erzeugt andere Session und bleibt vom Paketstore getrennt',()=>{const l=library(4);assert.notDeepEqual(createTopicCheck(l,2,()=>.01).orderedQuestionRefs,createTopicCheck(l,2,()=>.99).orderedQuestionRefs);storage.set('pwl-quiz-package-progress:v1:p01:x','untouched');saveTopicCheck(l,{...createInitialTopicCheck(l),...createTopicCheck(l,1)});assert.equal(storage.get('pwl-quiz-package-progress:v1:p01:x'),'untouched')})

const RAW_USER_ANSWER_SENTINEL = 'RAW_USER_ANSWER_SENTINEL_5921'
const PRIVATE_OPTION_TEXT_SENTINEL = 'PRIVATE_OPTION_TEXT_SENTINEL_7319'

function libraryWithMcOptions() {
  return {
    p01: {
      packageId: 'p01', packageNumber: 1, packageTitle: 'Thema 1',
      questions: [{ questionId: 'p01-mc', questionType: 'mc', question: 'MC?', options: ['A', PRIVATE_OPTION_TEXT_SENTINEL, 'C', 'D'], correctAnswer: 'A' }],
    },
  }
}

test('Phase 5A.3: Themencheck persistiert MC-Auswahl nur als kanonischen Index, nie als Optionstext', () => {
  const l = libraryWithMcOptions()
  const session = { ...createInitialTopicCheck(l), orderedQuestionRefs: [{ packageId: 'p01', questionId: 'p01-mc' }], answers: { 'p01::p01-mc': { questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL, correct: false } } }
  saveTopicCheck(l, session)
  const raw = storage.get(createTopicCheckKey(l))
  assert.equal(raw.includes(PRIVATE_OPTION_TEXT_SENTINEL), false)
  const loaded = loadTopicCheck(l)
  assert.equal('selectedAnswer' in loaded.answers['p01::p01-mc'], false)
  assert.equal(loaded.answers['p01::p01-mc'].selectedOptionIndex, 1)
})

test('Phase 5A.3: Legacy-Themencheck-Datensatz mit privatem MC-Optionstext wird beim Laden saniert', () => {
  const l = libraryWithMcOptions()
  const key = createTopicCheckKey(l)
  const legacy = { ...createInitialTopicCheck(l), orderedQuestionRefs: [{ packageId: 'p01', questionId: 'p01-mc' }], answers: { 'p01::p01-mc': { questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL, correct: false } } }
  storage.set(key, JSON.stringify(legacy))
  const loaded = loadTopicCheck(l)
  assert.equal('selectedAnswer' in loaded.answers['p01::p01-mc'], false)
  assert.equal(loaded.answers['p01::p01-mc'].selectedOptionIndex, 1)
  saveTopicCheck(l, loaded)
  assert.equal(storage.get(key).includes(PRIVATE_OPTION_TEXT_SENTINEL), false)
})

test('Phase 5A.1: rohe Freitextantwort im Themencheck wird nicht persistiert', () => {
  const l = library(2)
  const session = {
    ...createInitialTopicCheck(l),
    ...createTopicCheck(l, 1, () => 0.4),
    answers: { 'p01::p01-2': { questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL, status: 'yellow' } },
  }
  saveTopicCheck(l, session)
  const raw = storage.get(createTopicCheckKey(l))
  assert.equal(raw.includes(RAW_USER_ANSWER_SENTINEL), false)
  const loaded = loadTopicCheck(l)
  assert.equal('userAnswer' in loaded.answers['p01::p01-2'], false)
  assert.equal(loaded.answers['p01::p01-2'].status, 'yellow')
  assert.equal(loaded.answers['p01::p01-2'].answered, true)
})

test('Phase 5A.1: Legacy-Datensatz mit roher Antwort wird beim Laden saniert', () => {
  const l = library(2)
  const key = createTopicCheckKey(l)
  const legacy = {
    ...createInitialTopicCheck(l),
    orderedQuestionRefs: [{ packageId: 'p01', questionId: 'p01-2' }],
    answers: { 'p01::p01-2': { questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL, status: 'red' } },
  }
  storage.set(key, JSON.stringify(legacy))
  const loaded = loadTopicCheck(l)
  assert.equal('userAnswer' in loaded.answers['p01::p01-2'], false)
  assert.equal(loaded.answers['p01::p01-2'].status, 'red')
})

test('Phase 5A.1: fehlerhafter Themencheck-Storage-Inhalt crasht nicht', () => {
  const l = library(2)
  storage.set(createTopicCheckKey(l), '{not valid json')
  assert.doesNotThrow(() => loadTopicCheck(l))
  const loaded = loadTopicCheck(l)
  assert.deepEqual(loaded.answers, {})
  assert.equal(loaded.orderedQuestionRefs.length, 0)
})
