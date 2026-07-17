// Google 설문지와 공개 스프레드시트 정보를 입력하세요.
// formAction 예: https://docs.google.com/forms/d/e/FORM_ID/formResponse
// fields 값에는 Google Form의 문항별 entry ID를 입력합니다.
window.GOOGLE_INTEGRATION = {
  passage: {
    formAction: "",
    fields: { nickname: "", score: "", school: "", grade: "", source: "" }
  },
  word: {
    formAction: "https://docs.google.com/forms/d/e/1FAIpQLSc1mhtrc_YduwCKhv5p1a34ht60QuUG2beWgO-JMte9zxejDQ/formResponse",
    fields: {
      takenAt: "entry.2045556548",
      nickname: "entry.194269395",
      book: "entry.242375277",
      range: "entry.1482912308",
      score: "entry.1719752354",
      correct: "entry.1746685550",
      type: "entry.1016477595",
      question: "entry.479284833",
      userAnswer: "entry.604896489",
      answer: "entry.365270637"
    }
  },
  // Google 스프레드시트에서 파일 > 공유 > 웹에 게시 > CSV로 게시한 주소
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2F1RL3B02z_ZzHeCoEUY-bGSDL-pMtFxMCRhUV-tOf6AcdcloSfEcz8NXvFNIPOnRrmRbacJRgCNn/pub?gid=806658825&single=true&output=csv"
};
