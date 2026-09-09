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

const question = { questionNumber: 1, answer: 'The sky is blue.', korean: '하늘은 파랗다.' };
context.writingPracticeSession = { queue: [question], allQuestions: [question], index: 0, cycle: 1, cycleWrong: [], firstResults: [], firstAnswered: new Set(), bank: context.sentenceTokens(question.answer), answer: [], history: [], correction: false, awaitingNext: false };
const firstId = context.writingPracticeSession.bank[0].id;
context.moveWritingPracticeToken(firstId, 'answer');
assert.equal(context.writingPracticeSession.answer.length, 1);
context.undoWritingPracticeMove();
assert.equal(context.writingPracticeSession.answer.length, 0);
assert.equal(context.writingPracticeSession.bank.length, 4);

context.writingPracticeSession.answer = [context.writingPracticeSession.bank[3], context.writingPracticeSession.bank[2]];
context.submitWritingPracticeAnswer();
assert.equal(context.writingPracticeSession.correction, true);
assert.equal(context.writingPracticeSession.cycleWrong.length, 1);
assert.deepEqual(Array.from(context.writingPracticeSession.firstResults, (result) => result.correct), [false]);
assert.equal(context.$('#writingPracticeCorrectAnswer').textContent, 'the sky is blue');

context.writingPracticeSession.answer = context.sentenceTokens(question.answer);
context.submitWritingPracticeAnswer();
assert.equal(context.writingPracticeSession.awaitingNext, true);
context.nextWritingPracticeQuestion();
assert.equal(context.writingPracticeSession.cycle, 2);
assert.equal(context.writingPracticeSession.queue.length, 1);
assert.equal(context.writingPracticeSession.firstResults.length, 1);

console.log('Passed Writing Practice token formatting, undo, correction, and cycle retry checks.');
