import { createPackageBankFingerprint } from './packageProgressStore.js'
const PREFIX = 'pwl-quiz-topic-check:v1:'
function fingerprint(library) { return Object.values(library || {}).sort((a,b) => a.packageId.localeCompare(b.packageId)).map((bank) => `${bank.packageId}:${createPackageBankFingerprint(bank)}`).join('|') }
export function createTopicCheckKey(library) { return `${PREFIX}${fingerprint(library)}` }
export function createInitialTopicCheck(library) { return { schemaVersion: 1, libraryFingerprint: fingerprint(library), checkSize: 1, orderedQuestionRefs: [], currentQuestionIndex: 0, answers: {}, statistics: { correct: 0, wrong: 0, green: 0, yellow: 0, red: 0 }, sessionStatus: 'inProgress', updatedAt: null } }
export function loadTopicCheck(library) { const initial = createInitialTopicCheck(library); if (typeof window === 'undefined') return initial; try { const value = JSON.parse(window.localStorage.getItem(createTopicCheckKey(library))); return value?.schemaVersion === 1 && value.libraryFingerprint === initial.libraryFingerprint ? { ...initial, ...value, answers: value.answers || {}, statistics: { ...initial.statistics, ...(value.statistics || {}) } } : initial } catch { return initial } }
export function saveTopicCheck(library, session) { const value = { ...createInitialTopicCheck(library), ...session, updatedAt: new Date().toISOString() }; if (typeof window !== 'undefined') window.localStorage.setItem(createTopicCheckKey(library), JSON.stringify(value)); return value }
export function clearTopicCheck(library) { if (typeof window !== 'undefined') window.localStorage.removeItem(createTopicCheckKey(library)) }
export function hasTopicCheck(session) { return Boolean(session?.orderedQuestionRefs?.length) }
