const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'definitions.js'), 'utf8');
const stored = new Map();
let failSave = false;
async function setup(data, ok = true) {
  const elements = new Map();
  function element() {
    const classes = new Set();
    return { value: '', disabled: true, textContent: '', children: [], events: {},
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
      addEventListener(type, fn) { this.events[type] = fn; },
      focus() {}, setAttribute() {}, removeAttribute() {},
      replaceChildren() { this.children = []; }, append(child) { this.children.push(child); } };
  }
  const get = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  get('definitionName').value = '테스트 학생';
  vm.runInNewContext(source, { document: { getElementById: get, createElement: element },
    crypto: require('node:crypto'),
    readJson: (key, fallback) => stored.has(key) ? JSON.parse(stored.get(key)) : fallback,
    writeJson: (key, value) => { if (failSave) throw new Error('quota'); stored.set(key, JSON.stringify(value)); },
    fetch: async () => ({ ok, json: async () => data }) });
  await new Promise(resolve => setImmediate(resolve));
  return suffix => get('definition' + suffix);
}
(async () => {
  let el = await setup([]);
  assert.equal(el('Start').disabled, true);
  assert.match(el('Notice').textContent, /준비 중/);
  for (const data of [{}, [null], [{ word: 'a', definition: '' }]]) {
    el = await setup(data);
    assert.equal(el('Start').disabled, true);
    assert.match(el('Notice').textContent, /불러오지 못/);
  }
  el = await setup([], false);
  assert.match(el('Notice').textContent, /불러오지 못/);
  el = await setup([{ word: 'apple', definition: 'A fruit.' }, { word: 'brave', definition: 'Facing danger.' }]);
  el('Name').value = '';
  el('Start').events.click();
  assert.match(el('Feedback').textContent, /이름을 먼저/);
  el('Name').value = '테스트 학생';
  el('Start').events.click();
  assert.equal(el('Question').textContent, 'A fruit.');
  const submit = () => el('Form').events.submit({ preventDefault() {} });
  submit();
  assert.match(el('Feedback').textContent, /먼저 입력/);
  el('Answer').value = ' APPLE ';
  submit(); submit();
  assert.equal(JSON.parse(stored.get('exam.definitionResults')).length, 1);
  assert.equal(JSON.parse(stored.get('exam.definitionResults'))[0].answered, 1);
  assert.equal(el('Feedback').textContent, '정답입니다!');
  el('Next').events.click();
  assert.equal(el('Question').textContent, 'Facing danger.');
  el('Answer').value = 'wrong';
  submit();
  assert.match(el('Feedback').textContent, /정답: brave/);
  const saved = JSON.parse(stored.get('exam.definitionResults'))[0];
  assert.equal(saved.completed, true);
  assert.deepEqual(saved.wrongAnswers, [{ number: 2, definition: 'Facing danger.', userAnswer: 'wrong', answer: 'brave' }]);
  el('Next').events.click();
  assert.match(el('Feedback').textContent, /1개 정답 · 50점/);
  assert.equal(el('Result').children.length, 1);
  el('Next').events.click();
  el('Start').events.click();
  assert.equal(el('Result').children.length, 0);
  assert.equal(el('Progress').textContent, '1 / 2');
  failSave = true;
  el('Answer').value = 'wrong';
  submit();
  assert.match(el('SaveNotice').textContent, /저장하지 못/);
  failSave = false;
  const db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'definitions.json'), 'utf8'));
  assert.deepEqual(db.units.map(unit => unit.words.length), [45, 34]);
  for (const unit of db.units) assert.equal(new Set(unit.words.map(word => word.word)).size, unit.words.length);
  el = await setup(db);
  assert.equal(el('Unit').children.length, 2);
  assert.match(el('Notice').textContent, /5과 · 총 45개/);
  el('Unit').value = db.units[1].id;
  el('Unit').events.change();
  assert.match(el('Notice').textContent, /6과 · 총 34개/);
  el('Start').events.click();
  assert.equal(el('Unit').disabled, true);
  for (const word of db.units[1].words) {
    assert.equal(el('Question').textContent, word.definition);
    el('Answer').value = word.word;
    submit();
    el('Next').events.click();
  }
  assert.match(el('Feedback').textContent, /34개 정답 · 100점/);
  assert.equal(el('Unit').disabled, false);
  el('Unit').value = db.units[0].id;
  el('Unit').events.change();
  el('Start').events.click();
  assert.equal(el('Progress').textContent, '1 / 45');
  assert.equal(el('Question').textContent, db.units[0].words[0].definition);
  el('Answer').value = '<wrong>';
  submit();
  const partial = JSON.parse(stored.get('exam.definitionResults'))[0];
  assert.equal(partial.completed, false);
  assert.equal(partial.unit, '중3 천재 (이) 5과');
  await setup(db);
  assert.deepEqual(JSON.parse(stored.get('exam.definitionResults'))[0], partial, 'reload retains partial attempt');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const admin = { innerHTML: '' };
  const context = vm.createContext({ $: () => admin,
    readJson: (key, fallback) => stored.has(key) ? JSON.parse(stored.get(key)) : fallback,
    escapeHtml: value => String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;') });
  vm.runInContext(html.slice(html.indexOf('    function renderAdminDrilldown('), html.indexOf('    function savePasswords(')), context);
  vm.runInContext('renderAdminDrilldown({results: [], wrongAnswers: [], writingWrongAnswers: [], writingPracticeResults: [], listeningWrongAnswers: []})', context);
  assert.match(admin.innerHTML, /영영풀이/);
  assert.match(admin.innerHTML, /테스트 학생/);
  assert.match(admin.innerHTML, /진행 중/);
  assert.match(admin.innerHTML, /&lt;wrong&gt;/);
  console.log('Definition flow passed: DB validation, grading, results, restart, lesson selection and complete lesson 6.');
})();
