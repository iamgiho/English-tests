const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'grammar.json'), 'utf8'));
const wordCount = data.units[0].words.length;
const elements = new Map();
const stored = new Map();
let speeches = 0;
const context = vm.createContext({
  $: id => {
    if (!elements.has(id)) elements.set(id, { value: '', disabled: false, textContent: '', innerHTML: '', style: {}, classList: { toggle() {} }, focus() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {} });
    return elements.get(id);
  },
  window: { speechSynthesis: { cancel() {}, speak() { speeches++; } } },
  SpeechSynthesisUtterance: function(text) { this.text = text; },
  fetch: async () => ({ ok: true, json: async () => data }),
  escapeHtml: value => String(value), shuffle: values => [...values],
  setMessage: (element, message) => { element.textContent = message; },
  table: (headers, rows) => JSON.stringify(rows),
  readJson: (key, fallback) => stored.get(key) || fallback,
  writeJson: (key, value) => stored.set(key, value)
});
vm.runInContext(html.slice(html.indexOf('    function normalizeAnswer(value)'), html.indexOf('    function getWordBookMeta(')), context);
vm.runInContext(fs.readFileSync(path.join(root, 'grammar.js'), 'utf8').replace(/loadGrammar\(\);\s*$/, ''), context);
const run = code => vm.runInContext(code, context);
const state = () => run('grammarSession');
function answer(overrides = {}) {
  const s = state(), word = s.queue[s.index];
  for (const [key, id] of [['meaning', 'grammarMeaning'], ['past', 'grammarPast'], ['participle', 'grammarParticiple']]) {
    const el = context.$('#' + id);
    if (!el.disabled) el.value = overrides[key] ?? word[key][0];
  }
  run('submitGrammar()');
}
(async () => {
  await run('loadGrammar()');
  assert.equal(run('grammarUnits[0].words.length'), wordCount);
  context.$('#grammarUnitSelect').value = data.units[0].id;
  run('grammarUnitNotice()');
  assert.equal(Number(context.$('#grammarRangeStart').value), 1);
  assert.equal(Number(context.$('#grammarRangeEnd').value), wordCount);
  run('startGrammar()');
  assert.equal(state(), null, 'name required');
  context.$('#grammarName').value = '테스트';
  run('startGrammar()');
  assert.equal(speeches, 1);
  run('speakGrammar(); speakGrammar(); speakGrammar()');
  assert.equal(speeches, 3, 'automatic audio counts toward three');
  for (let round = 1; round <= 3; round++) {
    for (let i = 0; i < wordCount; i++) {
      assert.equal(state().round, round);
      if (round > 1) {
        run('nextGrammar()');
        assert.equal(state().index, i, 'must reveal before next');
        run('revealGrammar()');
      }
      run('nextGrammar()');
    }
  }
  assert.equal(state().stage, 'written');
  run('submitGrammar()');
  assert.equal(state().failed.size, 0, 'empty answer is not an error');
  answer({ past: 'wrong' });
  assert.equal(context.$('#grammarMeaning').disabled, true);
  assert.equal(context.$('#grammarParticiple').disabled, true);
  assert.match(context.$('#grammarPastFeedback').textContent, /과거형이 틀렸습니다/);
  answer({ past: 'wrong again' });
  assert.equal(state().answered, false);
  assert.equal(state().records.length, 1);
  answer();
  run('nextGrammar()');
  while (state().stage === 'written') { answer(); run('nextGrammar()'); }
  assert.equal(state().stage, 'retest');
  assert.equal(state().queue.length, 1);
  const before = speeches;
  run('speakGrammar()');
  assert.equal(speeches, before, 'retests have no audio');
  answer({ meaning: '오답', participle: 'bad' });
  answer(); run('nextGrammar()');
  assert.equal(state().stage, 'retest', 'copying cannot complete a retest');
  answer(); run('nextGrammar()');
  assert.equal(speeches, before, 'finishes without a listening test');
  assert.equal(state().stage, 'complete');
  const result = stored.get('exam.grammarResults')[0];
  assert.equal(result.total, wordCount * 3);
  assert.equal(result.correct, wordCount * 3 - 1);
  assert.equal(result.wrongAnswers.length, 1);
  assert.equal(stored.size, 1, 'grammar storage is separate');
  assert.equal(run("grammarMatches('설정하다', grammarUnits[0].words[10], 'meaning')"), true);
  assert.equal(run("grammarMatches('하게두다', grammarUnits[0].words[6], 'meaning')"), true);
  assert.equal(run("grammarMatches(' BET ', grammarUnits[0].words[0], 'past')"), true);
  assert.equal(run("grammarMatches('b-et', grammarUnits[0].words[0], 'past')"), false);
  run('resetGrammar()');
  assert.equal(state(), null);
  assert.equal(context.$('#grammarStart').disabled, false);
  context.$('#grammarRangeStart').value = '3';
  context.$('#grammarRangeEnd').value = '2';
  run('startGrammar()');
  assert.equal(state(), null, 'invalid range rejected');
  context.$('#grammarRangeStart').value = '2';
  context.$('#grammarRangeEnd').value = '3';
  run('startGrammar()');
  assert.equal(state().words.length, 2, 'selected range only');
  assert.equal(state().words[0].present, data.units[0].words[1].present);
  assert.equal(state().range, '2~3');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  for (let round = 1; round <= 3; round++) {
    for (let i = 0; i < 2; i++) {
      if (round > 1) run('revealGrammar()');
      run('nextGrammar()');
    }
  }
  const beforeWritten = speeches;
  while (state().stage === 'written') { answer(); run('nextGrammar()'); }
  assert.equal(state().stage, 'complete', 'perfect written test completes directly');
  assert.equal(speeches, beforeWritten);
  assert.equal(stored.get('exam.grammarResults')[0].total, 6);
  assert.equal(stored.get('exam.grammarResults')[0].score, 100);
  console.log(`PASS: ${wordCount} verbs, reveal rounds, learning audio, corrections, silent retests, direct completion, range scoring, storage, reset.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
