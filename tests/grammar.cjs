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
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { value: '', disabled: false, textContent: '', innerHTML: '', style: {}, handlers: {}, classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } }, focus() {}, setAttribute() {}, removeAttribute() {}, addEventListener(name, handler) { this.handlers[name] = handler; } });
    }
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
  const choiceUnit = data.units.find(unit => unit.id === 'that-what');
  assert.equal(choiceUnit.questions.length, 100);
  assert.equal(new Set(choiceUnit.questions.map(q => q.number)).size, 100);
  context.$('#grammarUnitSelect').value = 'that-what';
  run('grammarUnitNotice()');
  assert.equal(context.$('#grammarRangeEnd').value, 100);
  assert.equal(context.$('#grammarRangeStartLabel').textContent, '시작 문항 번호');
  const audioBeforeChoice = speeches;
  run('startGrammar()');
  assert.equal(state().stage, 'choice');
  assert.equal(context.$('#grammarAnswers').classList.contains('hidden'), true);
  assert.equal(context.$('#grammarChoices').classList.contains('hidden'), false);
  run('nextGrammar()');
  assert.equal(state().index, 0, 'must answer before advancing');
  for (let i = 0; i < 100; i++) {
    const q = state().queue[state().index];
    assert.equal(q.number, i + 1);
    assert.equal(context.$('#grammarReason').classList.contains('hidden'), true);
    assert.equal(context.$('#grammarReason').textContent, '');
    const answer = q.answer.toLowerCase();
    const submitted = i === 0 ? 'that' : answer;
    run(`submitGrammarChoice('${submitted}')`);
    assert.equal(context.$('#grammarReason').textContent, `이유: ${q.reason}`);
    assert.equal(context.$('#grammarReason').classList.contains('hidden'), false);
    assert.equal(context.$('#grammarThat').disabled, true);
    assert.ok(context.$('#grammarQuestion').innerHTML.includes(`>${q.answer}</strong>`));
    run("submitGrammarChoice('what')");
    run('nextGrammar()');
  }
  assert.equal(state().stage, 'retest');
  assert.equal(state().queue.length, 1);
  assert.equal(state().records.length, 1, 'double click cannot change first answer');
  run("submitGrammarChoice('that'); nextGrammar()");
  assert.equal(state().stage, 'retest');
  assert.equal(state().records.length, 1, 'retests do not alter original score');
  run("submitGrammarChoice('what'); nextGrammar()");
  assert.equal(state().stage, 'complete');
  const choiceResult = stored.get('exam.grammarResults')[0];
  assert.equal(choiceResult.score, 99);
  assert.equal(choiceResult.total, 100);
  assert.equal(choiceResult.retries, 2);
  assert.equal(choiceResult.wrongAnswers[0].reason, choiceUnit.questions[0].reason);
  assert.equal(speeches, audioBeforeChoice, 'choice tests have no audio');
  run('resetGrammar()');
  context.$('#grammarRangeStart').value = '100';
  context.$('#grammarRangeEnd').value = '101';
  run('startGrammar()');
  assert.equal(state(), null, 'choice range overflow rejected');
  context.$('#grammarRangeEnd').value = '100';
  run("startGrammar(); submitGrammarChoice('what'); nextGrammar()");
  assert.equal(stored.get('exam.grammarResults')[0].total, 1);
  assert.equal(stored.get('exam.grammarResults')[0].score, 100);
  context.$('#grammarUnitSelect').value = data.units[0].id;
  run('grammarUnitNotice(); startGrammar()');
  assert.equal(state().stage, 'learn');
  assert.equal(context.$('#grammarChoices').classList.contains('hidden'), true);
  assert.equal(context.$('#grammarRangeEnd').value, wordCount);
  run('resetGrammar()');
  const participles = data.units.find(unit => unit.id === 'present-past-participle');
  assert.equal(participles.questions.length, 100);
  assert.equal(new Set(participles.questions.map(q => q.number)).size, 100);
  context.$('#grammarUnitSelect').value = participles.id;
  run('grammarUnitNotice(); startGrammar()');
  assert.equal(state().stage, 'choice');
  assert.equal(context.$('#grammarBlankForm').classList.contains('hidden'), false);
  assert.equal(context.$('#grammarChoices').classList.contains('hidden'), true);
  assert.ok(context.$('#grammarQuestion').innerHTML.includes('(run: 달리다)'));
  assert.ok(participles.questions.every(q => /\([a-z]+: [가-힣 ,]+\)$/.test(q.sentence)), 'Every participle question includes a verb meaning');
  run("submitGrammarChoice('   '); nextGrammar()");
  assert.equal(state().index, 0);
  assert.equal(state().failed.size, 0);
  const beforeParticiple = speeches;
  for (let i = 0; i < 100; i++) {
    const q = state().queue[state().index];
    assert.equal(q.number, i + 1);
    assert.equal(context.$('#grammarReason').classList.contains('hidden'), true);
    const input = i === 0 ? 'runned' : ` ${q.answer.toUpperCase()} `;
    run(`submitGrammarChoice(${JSON.stringify(input)})`);
    assert.equal(context.$('#grammarReason').textContent, `이유: ${q.reason}`);
    assert.equal(context.$('#grammarBlankAnswer').disabled, true);
    assert.ok(context.$('#grammarQuestion').innerHTML.includes(`>${q.answer}</strong>`));
    run('nextGrammar()');
  }
  assert.equal(state().stage, 'retest');
  assert.equal(state().queue.length, 1);
  run("submitGrammarChoice('run'); nextGrammar()");
  assert.equal(state().stage, 'retest');
  run("submitGrammarChoice('running'); nextGrammar()");
  assert.equal(state().stage, 'complete');
  const participleResult = stored.get('exam.grammarResults')[0];
  assert.equal(participleResult.score, 99);
  assert.equal(participleResult.total, 100);
  assert.equal(participleResult.wrongAnswers.length, 1);
  assert.equal(participleResult.unit, participles.title);
  assert.equal(participleResult.retries, 2);
  assert.equal(speeches, beforeParticiple);
  assert.equal(context.$('#grammarBlankForm').classList.contains('hidden'), true);
  run('resetGrammar()');
  context.$('#grammarRangeStart').value = '100';
  context.$('#grammarRangeEnd').value = '101';
  run('startGrammar()');
  assert.equal(state(), null);
  context.$('#grammarRangeEnd').value = '100';
  run("startGrammar(); submitGrammarChoice('closed'); nextGrammar()");
  assert.equal(stored.get('exam.grammarResults')[0].score, 100);
  assert.equal(stored.get('exam.grammarResults')[0].total, 1);
  context.$('#grammarUnitSelect').value = 'that-what';
  run('grammarUnitNotice(); startGrammar()');
  assert.equal(context.$('#grammarBlankForm').classList.contains('hidden'), true);
  assert.equal(context.$('#grammarChoices').classList.contains('hidden'), false);
  run('resetGrammar()');
  const agreement = data.units.find(unit => unit.id === 'subject-verb-agreement');
  assert.equal(agreement.questions.length, 100);
  assert.deepEqual(agreement.questions.map(q => q.number), Array.from({length: 100}, (_, i) => i + 1));
  context.$('#grammarUnitSelect').value = agreement.id;
  run('grammarUnitNotice(); startGrammar()');
  assert.equal(state().stage, 'choice');
  assert.equal(context.$('#grammarBlankForm').classList.contains('hidden'), true);
  run("submitGrammarChoice('what'); nextGrammar()");
  assert.equal(state().index, 0, 'only the current choices are valid');
  const agreementAudio = speeches;
  for (let i = 0; i < 100; i++) {
    const q = state().queue[state().index];
    assert.equal(q.number, i + 1);
    assert.equal(context.$('#grammarReason').classList.contains('hidden'), true);
    assert.equal(context.$('#grammarThat').textContent, q.options[0]);
    assert.equal(context.$('#grammarWhat').textContent, q.options[1]);
    const submitted = i === 0 ? 'are' : q.answer;
    const button = context.$(submitted === q.options[0] ? '#grammarThat' : '#grammarWhat');
    button.handlers.click();
    assert.equal(state().answered, true);
    assert.equal(context.$('#grammarReason').textContent, `이유: ${q.reason}`);
    assert.equal(context.$('#grammarWhat').disabled, true);
    run('nextGrammar()');
  }
  assert.equal(state().stage, 'retest');
  assert.equal(state().queue.length, 1);
  context.$('#grammarWhat').handlers.click();
  run('nextGrammar()');
  assert.equal(state().stage, 'retest');
  context.$('#grammarThat').handlers.click();
  run('nextGrammar()');
  assert.equal(state().stage, 'complete');
  assert.equal(speeches, agreementAudio);
  const agreementResult = stored.get('exam.grammarResults')[0];
  assert.equal(agreementResult.unit, '수일치');
  assert.equal(agreementResult.score, 99);
  assert.equal(agreementResult.total, 100);
  assert.equal(agreementResult.wrongAnswers.length, 1);
  assert.equal(agreementResult.retries, 2);
  run('resetGrammar()');
  context.$('#grammarRangeStart').value = '54';
  context.$('#grammarRangeEnd').value = '55';
  run('startGrammar()');
  assert.equal(context.$('#grammarThat').textContent, 'am');
  context.$('#grammarThat').handlers.click();
  run('nextGrammar()');
  context.$('#grammarWhat').handlers.click();
  run('nextGrammar()');
  assert.equal(stored.get('exam.grammarResults')[0].score, 100);
  assert.equal(stored.get('exam.grammarResults')[0].total, 2);
  context.$('#grammarUnitSelect').value = 'that-what';
  run('grammarUnitNotice(); startGrammar()');
  assert.equal(context.$('#grammarThat').textContent, 'that');
  assert.equal(context.$('#grammarWhat').textContent, 'what');
  context.$('#grammarWhat').handlers.click();
  assert.equal(state().wrong.length, 0);
  run('resetGrammar()');
  const finite = data.units.find(unit => unit.id === 'finite-nonfinite');
  assert.equal(finite.questions.length, 100);
  assert.deepEqual(finite.questions.map(q => q.number), Array.from({length: 100}, (_, i) => i + 1));
  assert.deepEqual(finite.questions[99].options, ['shows', 'showing']);
  context.$('#grammarUnitSelect').value = finite.id;
  run('grammarUnitNotice(); startGrammar()');
  const finiteAudio = speeches;
  for (let i = 0; i < 100; i++) {
    const q = state().queue[state().index];
    assert.equal(q.number, i + 1);
    assert.equal(context.$('#grammarReason').classList.contains('hidden'), true);
    assert.equal(context.$('#grammarThat').textContent, q.options[0]);
    assert.equal(context.$('#grammarWhat').textContent, q.options[1]);
    const value = i === 3 ? 'written' : q.answer;
    context.$(value === q.options[0] ? '#grammarThat' : '#grammarWhat').handlers.click();
    assert.equal(context.$('#grammarReason').textContent, `이유: ${q.reason}`);
    assert.ok(context.$('#grammarQuestion').innerHTML.includes(`>${q.answer}</strong>`));
    run('nextGrammar()');
  }
  assert.equal(state().stage, 'retest');
  assert.equal(state().queue.length, 1);
  assert.equal(state().queue[0].number, 4);
  context.$('#grammarThat').handlers.click();
  run('nextGrammar()');
  assert.equal(state().stage, 'retest');
  context.$('#grammarWhat').handlers.click();
  run('nextGrammar()');
  assert.equal(state().stage, 'complete');
  const finiteResult = stored.get('exam.grammarResults')[0];
  assert.equal(finiteResult.unit, finite.title);
  assert.equal(finiteResult.score, 99);
  assert.equal(finiteResult.total, 100);
  assert.equal(finiteResult.wrongAnswers[0].answer, 'was written');
  assert.equal(finiteResult.retries, 2);
  assert.equal(speeches, finiteAudio);
  console.log(`PASS: ${wordCount} verbs and 400 grammar questions; dynamic choices, multiword answers, scoring, reasons, retests, ranges, unit switching.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
