// 고양이가 움직이고 명언도 알려줘요! - entry point
// todo.md 의 Phase 순서를 따라 기능을 추가합니다.

document.addEventListener("DOMContentLoaded", () => {
  const scene = document.getElementById("scene");
  const cat = document.getElementById("cat");
  const toggleBackgroundBtn = document.getElementById("toggle-background");
  const statusBar = document.getElementById("status-bar");

  // ---------- Phase 1: 배경 전환 ----------
  toggleBackgroundBtn.addEventListener("click", () => {
    scene.classList.toggle("bg-nature");
  });

  // ---------- Phase 2: 고양이 등장 및 이동 ----------
  const WALK_SPEED = 70; // px/sec
  const MIN_IDLE_MS = 1200;
  const MAX_IDLE_MS = 3000;

  let pos = { x: 0, y: 0 };

  function getBounds() {
    const statusBarHeight = statusBar.offsetHeight;
    const catWidth = cat.offsetWidth;
    const catHeight = cat.offsetHeight;
    return {
      minX: 0,
      minY: statusBarHeight,
      maxX: Math.max(0, scene.clientWidth - catWidth),
      maxY: Math.max(statusBarHeight, scene.clientHeight - catHeight),
    };
  }

  function setPosition(x, y) {
    pos = { x, y };
    cat.style.left = `${x}px`;
    cat.style.top = `${y}px`;
  }

  function randomPointInBounds() {
    const b = getBounds();
    return {
      x: b.minX + Math.random() * (b.maxX - b.minX),
      y: b.minY + Math.random() * (b.maxY - b.minY),
    };
  }

  function goIdle() {
    cat.classList.remove("state-walk");
    cat.classList.add("state-idle");
    setTimeout(walkToRandomPoint, MIN_IDLE_MS + Math.random() * (MAX_IDLE_MS - MIN_IDLE_MS));
  }

  function walkToRandomPoint() {
    const target = randomPointInBounds();
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 4) {
      goIdle();
      return;
    }

    cat.classList.toggle("facing-right", dx > 0);
    cat.classList.remove("state-idle");
    cat.classList.add("state-walk");

    const durationMs = (distance / WALK_SPEED) * 1000;
    cat.style.transition = `left ${durationMs}ms linear, top ${durationMs}ms linear`;

    requestAnimationFrame(() => {
      setPosition(target.x, target.y);
    });

    setTimeout(goIdle, durationMs);
  }

  // 초기 위치를 화면 중앙 근처에 배치하고 이동을 시작합니다.
  window.addEventListener("load", () => {
    const b = getBounds();
    setPosition((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
    setTimeout(walkToRandomPoint, 800);
  });

  // Phase 3~6: 정지/그루밍, 클릭 상호작용, 상태바 로직은 여기에 이어서 추가 예정
});
