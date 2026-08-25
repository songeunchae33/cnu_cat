// Supabase 프로젝트 설정 (로그인 + 고양이 데이터 저장용)
// supabase.com 에서 프로젝트를 만든 뒤 Project Settings > API 에서 값을 복사해 아래에 붙여넣으세요.
// anon/public key는 클라이언트에 그대로 노출되는 것이 정상입니다 (RLS로 접근을 제한함).
const SUPABASE_URL = "https://qiusqdztzjfwlpipyiit.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdXNxZHp0empmd2xwaXB5aWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMTEzMDYsImV4cCI6MjEwMjc4NzMwNn0.NNI-U53NC7m8ZM24dAjY-A_QwZpn-pLqcjQ_RSz3wMM";

// 친구 고양이 실시간 만남용 서버 (자체 Python 서버, Render에 배포)
// server/ 폴더를 Render에 Web Service로 배포한 뒤 그 주소를 여기에 넣으세요.
// 예: "https://cnu-cat-realtime.onrender.com"
const REALTIME_WS_URL = "https://cnu-cat-realtime.onrender.com";
