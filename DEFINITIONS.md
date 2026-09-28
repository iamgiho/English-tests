# 영영풀이 DB

`definitions.json`은 기존 단어 DB와 분리된 영영풀이 전용 파일입니다.
현재 중3 천재 (이) 5과 45개, 6과 34개가 등록되어 있습니다. 제공된 영영풀이 원문과 순서를 유지하며, celebrate/graduation 및 spot/rise는 각각 별도 항목입니다.

`units` 배열에 단원별 고유 `id`, 표시할 `title`, 단어 목록 `words`를 넣습니다. 각 단어 항목은 영어 단어 `word`와 영영풀이 `definition` 두 문자열로 구성합니다. 화면에서 단원을 선택하며 학습 중에는 단원 선택이 잠깁니다.

```json
{"units": [{"id": "example", "title": "예시 단원", "words": [
  { "word": "apple", "definition": "A round fruit with red or green skin." },
  { "word": "brave", "definition": "Willing to face danger or difficulty." }
]}]}
```

위 데이터는 형식 예시입니다. 실제 DB에는 포함하지 않았습니다.
문제는 파일 순서대로 출제되며 대소문자, 앞뒤 공백, 연속 공백은 채점에 영향을 주지 않습니다.
이름을 입력한 뒤 학습을 시작합니다. 매 답안 제출 시 응시 기록과 오답을 `exam.definitionResults` 키로 이 브라우저의 localStorage에 저장합니다. 관리자 탭의 영영풀이 → 이름 → 응시 날짜에서 단원, 진행 상태, 문항 번호, 풀이, 제출한 답과 정답을 확인합니다. 새로고침해도 기록은 유지되지만 브라우저 데이터 삭제 시 사라지며, 다른 기기로 공유하거나 외부 전송하지 않습니다.
