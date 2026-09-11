// Grammar uses its own word pool and result storage.
const grammarFields = [
  { key: 'meaning', id: 'grammarMeaning', label: '뜻' },
  { key: 'past', id: 'grammarPast', label: '과거형' },
  { key: 'participle', id: 'grammarParticiple', label: '과거분사형' }
];
let grammarUnits = [];
let grammarSession = null;
const grammarResultKey = 'exam.grammarResults';

async function loadGrammar() {
  try {
    const response = await fetch('grammar.json');
    if (!response.ok) throw new Error('load');
    const data = await response.json();
    if (!Array.isArray(data.units) || !data.units.length) throw new Error('units');
    const ids = new Set();
    for (const unit of data.units) {
      if (!unit.id || ids.has(unit.id) || !unit.title || !unit.words?.length) throw new Error('unit');
      ids.add(unit.id);
      const words = new Set();
      for (const word of unit.words) {
        if (typeof word.present !== 'string' || !word.present.trim() || words.has(word.present)) throw new Error('word');
        words.add(word.present);
        if (grammarFields.some(({ key }) => !Array.isArray(word[key]) || !word[key].length || word[key].some(v => typeof v !== 'string' || !v.trim()))) throw new Error('answer');
      }
    }
    grammarUnits = data.units;
    $('#grammarUnitSelect').innerHTML = grammarUnits.map(unit => `<option value="${escapeHtml(unit.id)}">${escapeHtml(unit.title)}</option>`).join('');
    $('#grammarStart').disabled = false;
    grammarUnitNotice();
  } catch {
    setMessage($('#grammarNotice'), 'Grammar 단어를 불러오지 못했습니다. 페이지를 새로고침해 주세요.', 'bad');
  }
}

function grammarUnitNotice() {
  const unit = grammarUnits.find(unit => unit.id === $('#grammarUnitSelect').value);
  if (!unit) return setMessage($('#grammarNotice'), '단원을 선택하세요.');
  $('#grammarRangeStart').value = 1;
  $('#grammarRangeEnd').value = unit.words.length;
  $('#grammarRangeStart').max = $('#grammarRangeEnd').max = unit.words.length;
  setMessage($('#grammarNotice'), `${unit.title} · 선택 가능 번호 1~${unit.words.length}`);
}

function grammarShow(id, visible) { $('#' + id).classList.toggle('hidden', !visible); }

function startGrammar() {
  const name = $('#grammarName').value.trim();
  const unit = grammarUnits.find(unit => unit.id === $('#grammarUnitSelect').value);
  const start = Number($('#grammarRangeStart').value);
  const end = Number($('#grammarRangeEnd').value);
  if (!name) { $('#grammarName').focus(); return setMessage($('#grammarFeedback'), '이름을 먼저 입력하세요.', 'bad'); }
  if (!unit) return;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || start > end || end > unit.words.length) {
    return setMessage($('#grammarFeedback'), `동사 번호를 1~${unit.words.length} 사이에서 올바르게 입력하세요.`, 'bad');
  }
  const words = unit.words.slice(start - 1, end);
  grammarSession = { name, unit, words, range: `${start}~${end}`, stage: 'learn', round: 1, queue: [...words], index: 0, wrong: [], records: [], failed: new Set(), corrections: 0, retries: 0, replays: 0, answered: false, pending: [] };
  $('#grammarName').disabled = $('#grammarUnitSelect').disabled = $('#grammarRangeStart').disabled = $('#grammarRangeEnd').disabled = $('#grammarStart').disabled = true;
  $('#grammarResult').innerHTML = '';
  renderGrammar();
}

function renderGrammar() {
  window.speechSynthesis?.cancel();
  const s = grammarSession;
  const word = s.queue[s.index];
  s.answered = false;
  s.pending = [];
  s.replays = 0;
  $('#grammarSound').disabled = false;
  const learning = s.stage === 'learn';
  const sound = s.stage === 'sound';
  grammarShow('grammarAnswers', !learning);
  grammarShow('grammarNext', true);
  grammarShow('grammarReveal', learning && s.round > 1);
  grammarShow('grammarSound', sound || (learning && s.round === 1));
  grammarShow('grammarReplay', sound || (learning && s.round === 1));
  $('#grammarNext').disabled = !learning || s.round > 1;
  $('#grammarSubmit').disabled = false;
  $('#grammarSubmit').textContent = '정답 확인';
  $('#grammarProgress').textContent = `${s.index + 1} / ${s.queue.length}`;
  $('#grammarStage').textContent = learning ? `3회 노출 학습 · ${s.round}회차` : s.stage === 'retest' ? '오답 재시험 · 현재형 보고 입력' : sound ? '듣기 시험' : '현재형 보고 입력';
  for (const field of grammarFields) {
    const input = $('#' + field.id);
    input.value = '';
    input.disabled = false;
    input.removeAttribute('aria-invalid');
    $('#' + field.id + 'Feedback').textContent = '';
  }
  if (learning) {
    const prompt = s.round === 3 ? word.meaning.join(', ') : word.present;
    $('#grammarQuestion').innerHTML = `<h3>${s.round === 1 ? '보고 들으며 익히세요.' : '가린 내용을 떠올린 뒤 확인하세요.'}</h3><p class="question-main grammar-study-prompt">${escapeHtml(prompt)}</p><div id="grammarHidden" class="grammar-form-grid">${grammarStudyCards(word, s.round, s.round === 1)}</div>`;
  } else {
    $('#grammarQuestion').innerHTML = `<h3>${sound ? '현재형을 듣고 세 칸을 입력하세요.' : '현재형을 보고 세 칸을 입력하세요.'}</h3><p class="question-main">${sound ? '🔊' : escapeHtml(word.present)}</p>`;
    $('#grammarMeaning').focus();
  }
  setMessage($('#grammarFeedback'), learning ? '학습을 마치면 다음을 누르세요.' : '뜻, 과거형, 과거분사형을 각각 입력하세요.');
  if (sound || (learning && s.round === 1)) speakGrammar();
}

function grammarStudyCards(word, round, revealed) {
  const fields = round === 3
    ? [{ key: 'present', label: '현재형' }, ...grammarFields.slice(1)]
    : grammarFields;
  return fields.map(field => {
    const value = field.key === 'present' ? word.present : word[field.key].join(' / ');
    return `<div class="grammar-form-card grammar-${field.key}"><span class="grammar-form-label">${field.label}</span><strong class="grammar-form-value">${revealed ? escapeHtml(value) : '<span class="grammar-covered">가려진 정답</span>'}</strong></div>`;
  }).join('');
}

function revealGrammar() {
  const s = grammarSession;
  if (!s || s.stage !== 'learn' || s.round === 1) return;
  const word = s.queue[s.index];
  $('#grammarHidden').innerHTML = grammarStudyCards(word, s.round, true);
  grammarShow('grammarReveal', false);
  $('#grammarNext').disabled = false;
}

function speakGrammar() {
  const s = grammarSession;
  if (!s || !(s.stage === 'sound' || (s.stage === 'learn' && s.round === 1))) return;
  $('#grammarReplay').textContent = `음성 ${s.replays} / 3`;
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return setMessage($('#grammarFeedback'), '이 브라우저에서는 음성을 지원하지 않습니다. 음성을 지원하는 브라우저에서 학습해 주세요.', 'bad');
  if (s.replays >= 3) return;
  const word = s.queue[s.index];
  // A pronunciation spelling avoids the past-tense reading of isolated "read".
  const utterance = new SpeechSynthesisUtterance(word.speech || word.present);
  utterance.lang = 'en-US';
  utterance.rate = 0.82;
  window.speechSynthesis.cancel();
  s.replays++;
  $('#grammarReplay').textContent = `음성 ${s.replays} / 3`;
  $('#grammarSound').disabled = s.replays >= 3;
  utterance.onerror = event => {
    if (['canceled', 'interrupted'].includes(event.error) || grammarSession !== s || s.queue[s.index] !== word) return;
    s.replays = Math.max(0, s.replays - 1);
    $('#grammarSound').disabled = false;
    $('#grammarReplay').textContent = `음성 ${s.replays} / 3`;
    setMessage($('#grammarFeedback'), '음성을 재생하지 못했습니다. 듣기 버튼을 다시 눌러 주세요.', 'bad');
  };
  window.speechSynthesis.speak(utterance);
}

function grammarMatches(value, word, key) {
  return word[key].some(answer => key === 'meaning' ? answersMatch(value, answer) : value.trim().toLowerCase() === answer.trim().toLowerCase());
}

function submitGrammar() {
  const s = grammarSession;
  if (!s || s.stage === 'learn' || s.stage === 'complete' || s.answered) return;
  const fields = s.pending.length ? grammarFields.filter(f => s.pending.includes(f.key)) : grammarFields;
  const empty = fields.find(f => !$('#' + f.id).value.trim());
  if (empty) { $('#' + empty.id).focus(); return setMessage($('#grammarFeedback'), `${empty.label}을 입력하세요.`, 'bad'); }
  const word = s.queue[s.index];
  const copying = s.pending.length > 0;
  const wrong = [];
  for (const field of fields) {
    const input = $('#' + field.id);
    const value = input.value.trim();
    const correct = grammarMatches(value, word, field.key);
    input.setAttribute('aria-invalid', String(!correct));
    input.disabled = correct;
    const feedback = $('#' + field.id + 'Feedback');
    feedback.style.color = correct ? 'var(--good)' : 'var(--bad)';
    feedback.textContent = correct ? (copying ? '따라 쓰기 완료' : '정답입니다.') : `${field.label}이 틀렸습니다. 정답: ${word[field.key].join(' / ')}`;
    if (!correct) {
      wrong.push(field.key);
      if (!copying && s.stage !== 'retest') {
        s.failed.add(`${s.stage}:${word.present}:${field.key}`);
        s.records.push({ stage: s.stage === 'sound' ? '듣기' : '현재형 보고 입력', present: word.present, field: field.label, userAnswer: value, answer: word[field.key].join(' / ') });
      }
      input.value = '';
    }
  }
  if (wrong.length) {
    if (!s.wrong.includes(word)) s.wrong.push(word);
    s.pending = wrong;
    $('#grammarSubmit').textContent = '따라 쓴 답 확인';
    setMessage($('#grammarFeedback'), '틀린 칸의 정답을 한 번 따라 쓰세요. 사이클이 끝나면 이 동사를 다시 시험합니다.', 'bad');
    $('#' + grammarFields.find(f => f.key === wrong[0]).id).focus();
    return;
  }
  if (copying) s.corrections++;
  s.pending = [];
  s.answered = true;
  $('#grammarSubmit').disabled = true;
  $('#grammarNext').disabled = false;
  $('#grammarNext').focus();
  setMessage($('#grammarFeedback'), copying ? '따라 쓰기를 마쳤습니다. 이 동사는 나중에 다시 출제됩니다.' : '세 칸 모두 정답입니다.', 'good');
}

function grammarBegin(stage, words) {
  const s = grammarSession;
  s.stage = stage;
  s.queue = shuffle([...words]);
  s.index = 0;
  s.wrong = [];
  renderGrammar();
}

function nextGrammar() {
  const s = grammarSession;
  if (!s || s.stage === 'complete' || $('#grammarNext').disabled) return;
  if (++s.index < s.queue.length) return renderGrammar();
  if (s.stage === 'learn') {
    if (++s.round <= 3) { s.index = 0; return renderGrammar(); }
    return grammarBegin('written', s.words);
  }
  if (s.stage !== 'retest') s.afterRetest = s.stage === 'written' ? 'sound' : 'complete';
  if (s.wrong.length) { s.retries++; return grammarBegin('retest', s.wrong); }
  if (s.afterRetest === 'sound') return grammarBegin('sound', s.words);
  finishGrammar();
}

function finishGrammar() {
  const s = grammarSession;
  s.stage = 'complete';
  window.speechSynthesis?.cancel();
  const total = s.words.length * 6;
  const correct = total - s.failed.size;
  const result = { name: s.name, unit: s.unit.title, range: s.range, total, correct, score: Math.round(correct / total * 100), retries: s.retries, corrections: s.corrections, wrongAnswers: s.records, takenAt: new Date().toLocaleString('ko-KR') };
  let saved = true;
  try { writeJson(grammarResultKey, [result, ...readJson(grammarResultKey, [])]); } catch { saved = false; }
  for (const id of ['grammarAnswers', 'grammarNext', 'grammarSound', 'grammarReplay', 'grammarReveal']) grammarShow(id, false);
  $('#grammarStage').textContent = '완료';
  $('#grammarQuestion').innerHTML = `<h3>Grammar 학습 완료</h3><p class="question-main">${result.score}점</p><p class="question-sub">본시험 ${correct} / ${total}항목 정답 · 오답 재시험 ${s.retries}회 · 모든 동사 통과</p>`;
  $('#grammarResult').innerHTML = s.records.length ? table(['단계', '현재형', '틀린 항목', '내 답', '정답'], s.records.map(r => [r.stage, r.present, r.field, r.userAnswer, r.answer])) : '<div class="notice good">최초 오답이 없습니다.</div>';
  setMessage($('#grammarFeedback'), saved ? '완료 결과와 본시험 최초 오답을 이 브라우저에 저장했습니다.' : '학습은 완료했지만 저장 공간 문제로 결과를 저장하지 못했습니다.', saved ? 'good' : 'bad');
  $('#grammarName').disabled = $('#grammarUnitSelect').disabled = $('#grammarRangeStart').disabled = $('#grammarRangeEnd').disabled = $('#grammarStart').disabled = false;
}

function resetGrammar() {
  window.speechSynthesis?.cancel();
  grammarSession = null;
  $('#grammarName').disabled = $('#grammarUnitSelect').disabled = $('#grammarRangeStart').disabled = $('#grammarRangeEnd').disabled = false;
  $('#grammarStart').disabled = !grammarUnits.length;
  for (const id of ['grammarAnswers', 'grammarNext', 'grammarSound', 'grammarReplay', 'grammarReveal']) grammarShow(id, false);
  $('#grammarStage').textContent = '대기';
  $('#grammarProgress').textContent = '0 / 0';
  $('#grammarQuestion').innerHTML = '<h3>Grammar 학습을 시작하세요.</h3><p class="question-sub">3회 노출 학습 → 세 칸 입력 시험 → 듣기 시험</p>';
  $('#grammarResult').innerHTML = '';
  setMessage($('#grammarFeedback'), '이름과 단원을 설정하세요.');
}

$('#grammarStart').addEventListener('click', startGrammar);
$('#grammarReset').addEventListener('click', resetGrammar);
$('#grammarUnitSelect').addEventListener('change', grammarUnitNotice);
$('#grammarReveal').addEventListener('click', revealGrammar);
$('#grammarSound').addEventListener('click', speakGrammar);
$('#grammarNext').addEventListener('click', nextGrammar);
$('#grammarAnswers').addEventListener('submit', event => { event.preventDefault(); submitGrammar(); });
$('#grammarAnswers').addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (event.isComposing || event.keyCode === 229) return;
  const inputs = grammarFields.map(f => $('#' + f.id)).filter(input => !input.disabled);
  const index = inputs.indexOf(event.target);
  if (index >= 0 && index < inputs.length - 1) inputs[index + 1].focus();
  else submitGrammar();
});
loadGrammar();
