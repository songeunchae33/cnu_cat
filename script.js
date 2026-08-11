// 고양이가 움직이고 명언도 알려줘요! - entry point
// Phase 1~6 기능은 todo.md 순서를 따라 구현합니다.

document.addEventListener("DOMContentLoaded", () => {
  const scene = document.getElementById("scene");
  const toggleBackgroundBtn = document.getElementById("toggle-background");

  // Phase 1: 배경 전환
  toggleBackgroundBtn.addEventListener("click", () => {
    scene.classList.toggle("bg-nature");
  });

  // Phase 2~6: 고양이 이동, 상호작용, 상태바 로직은 여기에 추가 예정
});
