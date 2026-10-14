// Run with: node tests/writing-practice.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const nodes = new Map();
const context = vm.createContext({
  $: (id) => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, { disabled: false, textContent: '', innerHTML: '', classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) } });
    }
    return nodes.get(id);
  },
  shuffle: (items) => [...items],
  setMessage: (node, text) => { node.textContent = text; },
  readJson: (_key, fallback) => fallback,
  writeJson() {},
  STORAGE: { writingPracticeResults: 'writingPracticeResults' },
  submitWritingPracticeResult() {}
});

vm.runInContext(`var writingPracticeSession = null;${html.slice(html.indexOf('    function normalizeWritingAnswer'), html.indexOf('    async function submitWritingPracticeResult'))}`, context);
vm.runInContext('renderWritingPracticeWords = () => {}; renderWritingPracticeQuestion = () => {};', context);

assert.equal(context.writingPracticeSentence('The sky is blue.'), 'the sky is blue');
assert.deepEqual(Array.from(context.sentenceTokens('The sky is blue.'), (token) => token.text), ['the', 'sky', 'is', 'blue']);
const chunks = (sentence) => Array.from(context.writingPracticeTokens(sentence), (token) => token.text);
assert.deepEqual(chunks('The sky is blue.'), ['the sky', 'is', 'blue']);
assert.deepEqual(chunks('She bought a new book.'), ['she', 'bought', 'a new book']);
assert.deepEqual(chunks('I eat an apple in front of the high school.'), ['i', 'eat', 'an apple', 'in front of', 'the high school']);
assert.deepEqual(chunks('They did not give up because of climate change.'), ['they', 'did', 'not', 'give up', 'because of', 'climate change']);
assert.deepEqual(chunks('Look, for example, at the sky.'), ['look,', 'for example,', 'at', 'the sky']);
assert.deepEqual(chunks('She can swim.'), ['she', 'can', 'swim']);
const repeated = context.writingPracticeTokens('A dog saw a dog.');
assert.equal(new Set(Array.from(repeated, (token) => token.id)).size, repeated.length);
// Check every source sentence: grouping must never lose, duplicate, or reorder text.
function checkPassages(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) checkPassages(filename);
    else if (entry.name.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
      for (const passage of data.passages || []) {
        for (const sentence of Array.isArray(passage.text) ? passage.text : []) {
          const grouped = chunks(sentence);
          assert.equal(grouped.join(' '), context.writingPracticeSentence(sentence).split(/\s+/).filter(Boolean).join(' '));
          assert.ok(grouped.every((chunk) => chunk.split(/\s+/).length <= 3));
        }
      }
    }
  }
}
checkPassages(path.join(__dirname, '..', '영어 지문 DB'));

const question = { questionNumber: 1, answer: 'The sky is blue.', korean: '하늘은 파랗다.' };
context.writingPracticeSession = { queue: [question], allQuestions: [question], index: 0, cycle: 1, cycleWrong: [], firstResults: [], firstAnswered: new Set(), bank: context.writingPracticeTokens(question.answer), answer: [], history: [], correction: false, awaitingNext: false };
const firstId = context.writingPracticeSession.bank[0].id;
context.moveWritingPracticeToken(firstId, 'answer');
assert.equal(context.writingPracticeSession.answer.length, 1);
context.undoWritingPracticeMove();
assert.equal(context.writingPracticeSession.answer.length, 0);
assert.equal(context.writingPracticeSession.bank.length, 3);

const originalTokens = [...context.writingPracticeSession.bank];
context.moveWritingPracticeToken(originalTokens[2].id, 'answer');
context.moveWritingPracticeToken(originalTokens[1].id, 'answer');
const submittedAnswer = [...context.writingPracticeSession.answer];
const remainingBank = [...context.writingPracticeSession.bank];
const moveHistory = [...context.writingPracticeSession.history];
context.submitWritingPracticeAnswer();
assert.deepEqual([...context.writingPracticeSession.answer], submittedAnswer);
assert.deepEqual([...context.writingPracticeSession.bank], remainingBank);
assert.deepEqual([...context.writingPracticeSession.history], moveHistory);
assert.equal(context.$('#writingPracticeComparison').classList.contains('hidden'), false);
assert.equal(context.writingPracticeSession.correction, true);
assert.equal(context.writingPracticeSession.cycleWrong.length, 1);
assert.deepEqual(Array.from(context.writingPracticeSession.firstResults, (result) => result.correct), [false]);
assert.equal(context.$('#writingPracticeCorrectAnswer').textContent, 'the sky is blue');

// Another incorrect submission retains the answer and does not duplicate the retry.
context.submitWritingPracticeAnswer();
assert.deepEqual([...context.writingPracticeSession.answer], submittedAnswer);
assert.equal(context.writingPracticeSession.cycleWrong.length, 1);
context.undoWritingPracticeMove();
assert.deepEqual(Array.from(context.writingPracticeSession.answer, (token) => token.text), ['blue']);
context.moveWritingPracticeToken(originalTokens[0].id, 'answer', 0);
context.moveWritingPracticeToken(originalTokens[1].id, 'answer', 1);
assert.equal(context.writingPracticeSession.bank.length, 0);
context.submitWritingPracticeAnswer();
assert.equal(context.writingPracticeSession.awaitingNext, true);
context.nextWritingPracticeQuestion();
assert.equal(context.writingPracticeSession.cycle, 2);
assert.equal(context.writingPracticeSession.queue.length, 1);
assert.equal(context.writingPracticeSession.firstResults.length, 1);

console.log('Passed Writing Practice token formatting, undo, correction, and cycle retry checks.');
