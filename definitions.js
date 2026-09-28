(() => {
  const el = id => document.getElementById(`definition${id}`);
  const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
  let words = [];
  let units = [];
  let session = null;
  const resultKey = 'exam.definitionResults';

  function saveProgress() {
    const result = {
      id: session.id, name: session.name, unit: session.unit, takenAt: session.takenAt,
      total: words.length, answered: session.records.length, correct: session.correct,
      completed: session.records.length === words.length,
      wrongAnswers: session.records.flatMap((record, index) => record.correct ? [] : [{
        number: index + 1, definition: record.definition, userAnswer: record.answer, answer: record.word
      }])
    };
    try {
      const saved = readJson(resultKey, []);
      writeJson(resultKey, [result, ...saved.filter(item => item.id !== result.id)]);
      el('SaveNotice').textContent = '답안 기록을 이 브라우저에 저장했습니다. 관리자 탭에서 확인할 수 있습니다.';
    } catch {
      el('SaveNotice').textContent = '답안 기록을 저장하지 못했습니다. 브라우저 저장 공간이나 설정을 확인해 주세요.';
    }
  }

  async function load() {
    try {
      const response = await fetch('definitions.json');
      if (!response.ok) throw new Error('load');
      const data = await response.json();
      const loaded = Array.isArray(data) ? [{ id: 'default', title: '영영풀이', words: data }] : data?.units;
      const ids = new Set();
      if (!Array.isArray(loaded) || loaded.some(unit => {
        if (!unit || typeof unit.id !== 'string' || !unit.id.trim() || ids.has(unit.id) ||
          typeof unit.title !== 'string' || !unit.title.trim() || !Array.isArray(unit.words)) return true;
        ids.add(unit.id);
        return unit.words.some(item => !item ||
        typeof item.word !== 'string' || !item.word.trim() ||
        typeof item.definition !== 'string' || !item.definition.trim());
      })) throw new Error('format');
      units = loaded;
      el('Unit').replaceChildren();
      for (const unit of units) {
        const option = document.createElement('option');
        option.value = unit.id;
        option.textContent = unit.title;
        el('Unit').append(option);
      }
      el('Unit').value = units[0]?.id || '';
      el('Unit').disabled = !units.length;
      selectUnit();
    } catch {
      el('Notice').textContent = '영영풀이 DB를 불러오지 못했습니다. 파일과 데이터 형식을 확인한 뒤 새로고침해 주세요.';
      el('Question').textContent = '데이터를 불러올 수 없습니다.';
      el('Feedback').textContent = '새로고침 후 다시 시도해 주세요.';
    }
  }

  function selectUnit() {
    if (session) return;
    const unit = units.find(unit => unit.id === el('Unit').value);
    words = (unit?.words || []).map(item => ({ word: item.word.trim(), definition: item.definition.trim() }));
    el('Start').disabled = !words.length;
    el('Start').textContent = '학습 시작';
    el('Progress').textContent = `0 / ${words.length}`;
    el('Result').replaceChildren();
    el('Form').classList.add('hidden');
    el('Notice').textContent = words.length ? `${unit.title} · 총 ${words.length}개 단어 · 대소문자와 앞뒤 공백은 구분하지 않습니다.` : '영영풀이 DB 준비 중입니다. 단어가 등록되면 학습을 시작할 수 있습니다.';
    el('Question').textContent = words.length ? '학습 시작을 눌러 주세요.' : '등록된 영영풀이가 없습니다.';
    el('Feedback').textContent = words.length ? '풀이를 보고 영어 단어를 떠올려 보세요.' : 'DB 등록 후 학습할 수 있습니다.';
  }
  el('Unit').addEventListener('change', selectUnit);

  function render() {
    session.answered = false;
    el('Progress').textContent = `${session.index + 1} / ${words.length}`;
    el('Question').textContent = words[session.index].definition;
    el('Answer').value = '';
    el('Answer').disabled = false;
    el('Answer').removeAttribute('aria-invalid');
    el('Submit').disabled = false;
    el('Next').classList.add('hidden');
    el('Feedback').textContent = '알맞은 영어 단어를 입력하세요.';
    el('Answer').focus();
  }

  el('Start').addEventListener('click', () => {
    if (!words.length) return;
    const name = el('Name').value.trim();
    if (!name) {
      el('Feedback').textContent = '이름을 먼저 입력하세요.';
      el('Name').focus();
      return;
    }
    session = { id: crypto.randomUUID(), name, unit: units.find(unit => unit.id === el('Unit').value).title,
      takenAt: new Date().toLocaleString('ko-KR'), index: 0, correct: 0, answered: false, records: [] };
    el('Name').disabled = true;
    el('SaveNotice').textContent = '';
    el('Start').disabled = true;
    el('Unit').disabled = true;
    el('Result').replaceChildren();
    el('Form').classList.remove('hidden');
    render();
  });

  el('Form').addEventListener('submit', event => {
    event.preventDefault();
    if (!session || session.answered) return;
    const answer = el('Answer').value.trim();
    if (!answer) {
      el('Feedback').textContent = '영어 단어를 먼저 입력하세요.';
      el('Answer').focus();
      return;
    }
    const word = words[session.index];
    const correct = normalize(answer) === normalize(word.word);
    session.answered = true;
    session.correct += Number(correct);
    session.records.push({ ...word, answer, correct });
    saveProgress();
    el('Answer').disabled = true;
    el('Answer').setAttribute('aria-invalid', String(!correct));
    el('Submit').disabled = true;
    el('Feedback').textContent = correct ? '정답입니다!' : `오답입니다. 정답: ${word.word}`;
    el('Next').textContent = session.index === words.length - 1 ? '결과 보기' : '다음 문제';
    el('Next').classList.remove('hidden');
    el('Next').focus();
  });

  el('Next').addEventListener('click', () => {
    if (!session || !session.answered) return;
    session.index++;
    if (session.index < words.length) return render();
    el('Form').classList.add('hidden');
    el('Question').textContent = '학습 완료!';
    el('Feedback').textContent = `${words.length}문제 중 ${session.correct}개 정답 · ${Math.round(session.correct / words.length * 100)}점`;
    const wrong = session.records.filter(record => !record.correct);
    for (const record of wrong) {
      const item = document.createElement('p');
      item.textContent = `${record.definition} → 정답: ${record.word} (입력: ${record.answer})`;
      el('Result').append(item);
    }
    el('Start').textContent = '다시 학습';
    el('Start').disabled = false;
    session = null;
    el('Name').disabled = false;
    el('Unit').disabled = false;
    el('Start').focus();
  });

  load();
})();
