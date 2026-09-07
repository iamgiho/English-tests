const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const nodes = new Map(), stored = new Map(), sent = [], speech = [];
const ctx = vm.createContext({
  $: id => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, { value: '', disabled: false, textContent: '', innerHTML: '',
        classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
        focus() {}, addEventListener(type, handler) { this[type] = handler; }
      });
    }
    return nodes.get(id);
  },
  window: { speechSynthesis: { cancel() {}, speak: x => speech.push(x) } },
  SpeechSynthesisUtterance: function(text) { this.text = text; },
  setTimeout() {}, escapeHtml: x => x, shuffle: x => [...x].reverse(),
  setMessage: (el, text) => { el.textContent = text; },
  STORAGE: { wordPracticeResults: 'results' },
  readJson: (key, fallback) => stored.get(key) || fallback,
  writeJson: (key, value) => stored.set(key, value),
  submitWordResult: result => { sent.push(result); return Promise.resolve('test only'); }
});
vm.runInContext(
  html.slice(html.indexOf('    function normalizeAnswer(value)'), html.indexOf('    function getWordBookMeta(')) +
  html.slice(html.indexOf('    function speakPracticeWord('), html.indexOf('    function buildWordQuestion(')) +
  html.slice(html.indexOf('    $("#startWordPracticeBtn").addEventListener'), html.indexOf('    $("#adminLoginBtn").addEventListener')),
  ctx
);
const input = ctx.$('#wordPracticeAnswer');
const next = () => ctx.$('#nextWordPracticeBtn').click();
const enter = extra => input.keydown({ key: 'Enter', preventDefault() {}, ...extra });
const words = [
  { number: 37, en: 'bike(bicycle)', ko: '자전거' },
  { number: 38, en: 'hands-on', ko: '실제의, 직접 해 보는' },
  { number: 39, en: "try one's luck", ko: '운을 시험하다' }
];
ctx.currentPracticeWords = words;
ctx.wordBookManifest = [{ title: '검증용' }];
ctx.$('#wordPracticeBookSelect').value = '0';
ctx.$('#wordPracticeStart').value = '37';
ctx.$('#wordPracticeEnd').value = '39';
ctx.$('#wordPracticeName').value = '';
ctx.startWordPractice();
assert.match(ctx.$('#wordPracticeNotice').textContent, /이름/);
ctx.$('#wordPracticeName').value = '자동 검증';
ctx.$('#wordPracticeEnd').value = '36';
ctx.startWordPractice();
assert.match(ctx.$('#wordPracticeNotice').textContent, /번호/);
ctx.$('#wordPracticeEnd').value = '39';
ctx.startWordPractice();
const session = ctx.wordPracticeSession;
for (let round = 1; round <= 3; round++) {
  for (let index = 0; index < 3; index++) {
    assert.equal(session.round, round);
    assert.equal(session.index, index);
    if (round > 1) ctx.revealWordPractice();
    next();
  }
}
assert.equal(session.stage, 'meaning');
input.value = '  ';
enter();
assert.equal(session.answered, false);
assert.equal(session.wrong.length, 0);

// Simulate a Korean IME Enter used only to commit the final syllable.
input.value = '운을 시험하다';
enter({ isComposing: true });
assert.equal(session.answered, false, 'IME composition Enter must not submit');
enter({ keyCode: 229 });
assert.equal(session.answered, false, 'IME keyCode 229 must not submit');

let actions = 0;
const attempts = new Map();
while (ctx.$('#wordPracticeStage').textContent !== '완료') {
  assert.ok(++actions < 150, 'practice must finish');
  const word = session.queue[session.index];
  const key = session.stage.replace('-retest', '') + ':' + word.number;
  if (session.answered) { next(); continue; }
  if (session.correction) {
    ctx.showWordPracticeAnswer();
    input.value = ctx.$('#wordPracticeFeedback').textContent.match(/“([^”]+)”/)[1];
    enter();
    assert.equal(session.answered, true);
    continue;
  }
  const attempt = attempts.get(key) || 0;
  attempts.set(key, attempt + 1);
  // Fail one word twice in every stage; other words must not be retested.
  const expected = session.stage.startsWith('meaning') ? word.ko : word.en;
  input.value = word.number === 37 && attempt < 2 ? 'wrong answer' : ctx.wordPracticeCopyAnswer(expected);
  if (actions % 2) enter(); else next();
}
assert.equal(sent.length, 1);
assert.equal(stored.get('results').length, 1);
assert.equal(sent[0].total, 9);
assert.equal(sent[0].correct, 6);
assert.equal(sent[0].score, 67);
assert.equal(sent[0].wrongAnswers.length, 3);
for (const [key, count] of attempts) assert.equal(count, key.endsWith(':37') ? 3 : 1);
assert.equal(ctx.$('#nextWordPracticeBtn').disabled, true);
// Stale keyboard/click events after completion cannot save the result again.
enter(); next();
assert.equal(sent.length, 1, 'completion must save/send only once');
ctx.resetWordPractice();
assert.equal(ctx.wordPracticeSession, null);
assert.equal(ctx.$('#wordPracticeStage').textContent, '대기');
assert.equal(ctx.$('#nextWordPracticeBtn').disabled, true);
ctx.startWordPractice();
assert.equal(ctx.wordPracticeSession.stage, 'learn');
assert.equal(ctx.wordPracticeSession.firstWrongAnswers.length, 0);
const restartedFeedback = ctx.$('#wordPracticeFeedback').textContent;
Promise.resolve().then(() => {
  assert.equal(ctx.$('#wordPracticeFeedback').textContent, restartedFeedback,
    'previous result response must not overwrite a restarted practice');
  for (let i = 0; i < 9; i++) next();
  let perfectActions = 0;
  while (ctx.$('#wordPracticeStage').textContent !== '완료') {
    assert.ok(++perfectActions < 30);
    const current = ctx.wordPracticeSession;
    if (current.answered) { next(); continue; }
    const word = current.queue[current.index];
    input.value = current.stage.startsWith('meaning') ? word.ko : word.en;
    enter();
  }
  assert.equal(sent.length, 2);
  assert.equal(sent[1].score, 100);
  assert.equal(sent[1].wrongAnswers.length, 0);
  assert.equal(stored.get('results').length, 2);
  assert.equal(stored.get('results')[0].score, 100);
  console.log(`Passed full practice flows (${actions + perfectActions} actions), IME, validation, scores (67/100), deduplication, async response, reset and restart checks.`);
});
