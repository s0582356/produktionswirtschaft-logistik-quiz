import {test,afterEach}from'node:test';import assert from'node:assert/strict';import{createExam}from'../src/utils/examLogic.js';import{createExamKey,initialExam,saveExam,loadExam}from'../src/utils/examStore.js';const m=new Map;global.window={localStorage:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};afterEach(()=>m.clear());function l(n=11){return Object.fromEntries(Array.from({length:n},(_,i)=>{let id=`p${String(i+1).padStart(2,'0')}`;return[id,{packageId:id,questions:Array.from({length:6},(_,j)=>({questionId:`${id}-${j}`,questionType:['mc','yesNo','freeText'][j%3],question:'synthetic'}))}]}))}for(const n of[20,35,50])test(`Klausur ${n}`,()=>{let x=createExam(l(),n,()=>.4);assert.equal(x.orderedQuestionRefs.length,n);assert.equal(new Set(x.orderedQuestionRefs.map(r=>r.packageId+r.questionId)).size,n);assert.equal(new Set(x.orderedQuestionRefs.map(r=>r.packageId)).size,11)});test('Resume und isolierter Store',()=>{let x=l(5),e={...initialExam(x),...createExam(x,20,()=>.2),answers:{'p01::p01-0':{selectedAnswer:'A',correct:true}}};saveExam(x,e);assert.deepEqual(loadExam(x).orderedQuestionRefs,e.orderedQuestionRefs);assert.equal(m.get(createExamKey(x)).includes('synthetic'),false);m.set('pwl-quiz-package-progress:v1:x','ok');assert.equal(m.get('pwl-quiz-package-progress:v1:x'),'ok')})

const RAW_USER_ANSWER_SENTINEL = 'RAW_USER_ANSWER_SENTINEL_5921'

test('Phase 5A.1: rohe Freitextantwort in der Klausur wird nicht persistiert', () => {
  const lib = l(3)
  const session = { ...initialExam(lib), ...createExam(lib, 6, () => 0.3), answers: { 'p01::p01-2': { questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL } } }
  saveExam(lib, session)
  const raw = m.get(createExamKey(lib))
  assert.equal(raw.includes(RAW_USER_ANSWER_SENTINEL), false)
  const loaded = loadExam(lib)
  assert.equal('userAnswer' in loaded.answers['p01::p01-2'], false)
  assert.equal(loaded.answers['p01::p01-2'].answered, true)
})

test('Phase 5A.1: Legacy-Klausur-Datensatz mit roher Antwort wird beim Laden saniert', () => {
  const lib = l(3)
  const legacy = { ...initialExam(lib), orderedQuestionRefs: [{ packageId: 'p01', questionId: 'p01-2' }], answers: { 'p01::p01-2': { questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL, status: 'green' } } }
  m.set(createExamKey(lib), JSON.stringify(legacy))
  const loaded = loadExam(lib)
  assert.equal('userAnswer' in loaded.answers['p01::p01-2'], false)
  assert.equal(loaded.answers['p01::p01-2'].status, 'green')
})

test('Phase 5A.1: fehlerhafter Klausur-Storage-Inhalt crasht nicht', () => {
  const lib = l(3)
  m.set(createExamKey(lib), '{not valid json')
  assert.doesNotThrow(() => loadExam(lib))
  assert.deepEqual(loadExam(lib).answers, {})
})

const PRIVATE_OPTION_TEXT_SENTINEL = 'PRIVATE_OPTION_TEXT_SENTINEL_7319'

function libraryWithMcOptions() {
  return { p01: { packageId: 'p01', questions: [{ questionId: 'p01-mc', questionType: 'mc', question: 'MC?', options: ['A', PRIVATE_OPTION_TEXT_SENTINEL, 'C', 'D'], correctAnswer: 'A' }] } }
}

test('Phase 5A.3: Klausur persistiert MC-Auswahl nur als kanonischen Index, nie als Optionstext', () => {
  const lib = libraryWithMcOptions()
  const session = { ...initialExam(lib), orderedQuestionRefs: [{ packageId: 'p01', questionId: 'p01-mc' }], answers: { 'p01::p01-mc': { questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL } } }
  saveExam(lib, session)
  assert.equal(m.get(createExamKey(lib)).includes(PRIVATE_OPTION_TEXT_SENTINEL), false)
  const loaded = loadExam(lib)
  assert.equal('selectedAnswer' in loaded.answers['p01::p01-mc'], false)
  assert.equal(loaded.answers['p01::p01-mc'].selectedOptionIndex, 1)
})

test('Phase 5A.3: Legacy-Klausur-Datensatz mit privatem MC-Optionstext wird beim Laden saniert', () => {
  const lib = libraryWithMcOptions()
  const legacy = { ...initialExam(lib), orderedQuestionRefs: [{ packageId: 'p01', questionId: 'p01-mc' }], answers: { 'p01::p01-mc': { questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL } } }
  m.set(createExamKey(lib), JSON.stringify(legacy))
  const loaded = loadExam(lib)
  assert.equal('selectedAnswer' in loaded.answers['p01::p01-mc'], false)
  assert.equal(loaded.answers['p01::p01-mc'].selectedOptionIndex, 1)
  saveExam(lib, loaded)
  assert.equal(m.get(createExamKey(lib)).includes(PRIVATE_OPTION_TEXT_SENTINEL), false)
})