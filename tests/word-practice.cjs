// Run with: node tests/word-practice.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const elements = new Map();
const context = vm.createContext({
  $: (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: '', disabled: false, classList: { add() {}, remove() {} }, focus() {}
    });
    return elements.get(id);
  },
  setMessage(element, message) { element.textContent = message; },
  shuffle: (words) => [...words],
  escapeHtml: (text) => text,
  speakPracticeWord() {},
  setTimeout() {},
  finishWordPractice() { context.completed = true; }
});
vm.runInContext(
  html.slice(html.indexOf('    function normalizeAnswer(value)'), html.indexOf('    function getWordBookMeta(')) +
  html.slice(html.indexOf('    function renderWordPractice()'), html.indexOf('    function finishWordPractice()')),
  context
);

function start(word, stage) {
  context.completed = false;
  context.wordPracticeSession = {
    words: [word], queue: [word], stage, index: 0, correct: 0,
    wrong: [], firstWrongAnswers: [], firstWrongKeys: new Set(), mastered: new Set(),
    answered: false, correction: false, soundAttempt: 1
  };
  return context.wordPracticeSession;
}
function submit(value) {
  context.$('#wordPracticeAnswer').value = value;
  context.submitWordPracticeAnswer();
}

let checked = 0;
for (const file of fs.readdirSync(path.join(root, '영어 단어'))) {
  if (!file.endsWith('.txt')) continue;
  for (const word of context.parseWordBook(fs.readFileSync(path.join(root, '영어 단어', file), 'utf8'))) {
    for (const stage of ['meaning', 'meaning-retest', 'spell', 'spell-retest', 'sound']) {
      const expected = stage.startsWith('meaning') ? word.ko : word.en;
      const copy = context.wordPracticeCopyAnswer(expected) || expected;
      for (const answer of new Set([expected, copy])) {
        const session = start(word, stage);
        submit(answer);
        assert.equal(session.answered, true, `${file}:${word.number} ${stage}: ${answer}`);
        assert.equal(session.correct, 1);
        assert.equal(session.wrong.length, 0);
        checked++;
      }
    }
  }
}

// An incorrect answer must still be copied and retested, then advance normally.
for (const word of [
  { number: 1, en: 'bike(bicycle)', ko: '자전거' },
  { number: 2, en: 'hands-on', ko: '실제의, 직접 해 보는' },
  { number: 3, en: "try one's luck", ko: '운을 시험하다' }
]) {
  for (const stage of ['meaning-retest', 'spell-retest', 'sound']) {
    const session = start(word, stage);
    submit('definitely incorrect');
    assert.equal(session.correction, true);
    submit('still incorrect');
    assert.equal(session.answered, false);
    context.showWordPracticeAnswer();
    const displayed = context.$('#wordPracticeFeedback').textContent.match(/“([^”]+)”/)[1];
    submit(displayed);
    assert.equal(session.answered, true);
    assert.equal(session.correct, 0);
    context.advanceWordPractice();
    assert.equal(session.stage, stage);
    assert.equal(session.answered, false);
    submit(displayed);
    assert.equal(session.correct, 1);
    context.advanceWordPractice();
    if (stage === 'sound') assert.equal(context.completed, true);
    else assert.equal(session.stage, stage === 'meaning-retest' ? 'spell' : 'sound');
    assert.equal(session.firstWrongAnswers.length, 1);
  }
}

for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
  new vm.Script(match[1]);
}
console.log(`Passed ${checked} word answer checks, 9 correction/retest flows, and script syntax checks.`);
