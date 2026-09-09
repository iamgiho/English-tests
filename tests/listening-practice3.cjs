// Run with: node tests/listening-practice3.cjs
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
  normalizeWritingAnswer: (value) => String(value).toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim(),
  writingPracticeSentence: (value) => String(value).replace(/[.]+$/, '').replace(/^([A-Z])/, (letter) => letter.toLowerCase()),
  sentenceTokens: (value) => String(value).replace(/[.]+$/, '').replace(/^([A-Z])/, (letter) => letter.toLowerCase()).split(/\s+/).map((text, index) => ({ id: String(index), text })),
  countEnglishWords: (value) => String(value).split(/\s+/).length,
  window: { speechSynthesis: { cancel() {} } },
  STORAGE: { listeningResults: 'listeningResults' },
  readJson: (_key, fallback) => fallback,
  writeJson() {},
  renderListeningWrongAnswers() {},
  getLocalListeningWrongAnswers: () => [],
  submitListeningResult: () => Promise.resolve('saved')
});
const source = html.slice(html.indexOf('    async function startListeningPractice3'), html.indexOf('    function parseCsv'));
vm.runInContext(`var listeningPractice3Session = null;${source}`, context);
vm.runInContext('renderListeningPractice3Words = () => {}; renderListeningPractice3Question = () => {};', context);

const question = { questionNumber: 1, answer: 'The sky is blue.', korean: '하늘은 파랗다.' };
context.listeningPractice3Session = { nickname: 'test', meta: {}, allQuestions: [question], queue: [question], index: 0, cycle: 1, cycleWrong: [], firstWrongAnswers: [], firstWrongNumbers: new Set(), bank: [], answer: context.sentenceTokens('blue sky the is'), awaitingNext: false };
context.submitListeningPractice3Answer();
assert.equal(context.listeningPractice3Session.cycleWrong.length, 1);
assert.equal(context.listeningPractice3Session.firstWrongAnswers.length, 1);
assert.equal(context.$('#listeningPractice3CorrectAnswer').textContent, 'the sky is blue');
context.nextListeningPractice3Question();
assert.equal(context.listeningPractice3Session.cycle, 2);
assert.equal(context.listeningPractice3Session.queue.length, 1);

context.listeningPractice3Session.answer = context.sentenceTokens(question.answer);
context.listeningPractice3Session.awaitingNext = false;
context.submitListeningPractice3Answer();
assert.equal(context.listeningPractice3Session.awaitingNext, true);
assert.equal(context.listeningPractice3Session.firstWrongAnswers.length, 1);

console.log('Passed Listening Practice 3 token answer and cycle retry checks.');
