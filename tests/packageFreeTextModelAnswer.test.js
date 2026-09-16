import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function sources() {
  const [card, trainer] = await Promise.all([
    readFile(new URL('../src/components/FreeTextCard.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/PackageTrainer.vue', import.meta.url), 'utf8'),
  ])
  return { card, trainer }
}

test('Paket-Freitext: Musterlösung ist ein optionaler, nach Bewertung sichtbarer Toggle', async () => {
  const { card, trainer } = await sources()
  assert.match(card, /showModelAnswerToggle: \{ type: Boolean, default: false \}/)
  assert.match(card, /v-if="showModelAnswerToggle && question\.modelAnswer"/)
  assert.match(card, /v-if="modelAnswerOpen"/)
  assert.match(card, /▶ Musterlösung anzeigen/)
  assert.match(card, /▼ Musterlösung ausblenden/)
  assert.match(trainer, /:show-model-answer-toggle="true"/)
})

test('Paket-Freitext: fehlende modelAnswer verhindert Toggle, Standardmodus behält direkte Musterlösung', async () => {
  const { card } = await sources()
  assert.match(card, /showModelAnswerToggle && question\.modelAnswer/)
  assert.match(card, /v-else class="feedback-section model-answer"/)
  assert.match(card, /const modelAnswerOpen = ref\(false\)/)
  assert.doesNotMatch(card, /orderedQuestionIds.*modelAnswerOpen|modelAnswerOpen.*orderedQuestionIds/)
})
