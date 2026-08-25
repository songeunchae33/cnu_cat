// 고양이가 움직이고 명언도 알려줘요! - entry point
// todo.md 의 Phase 순서를 따라 기능을 추가합니다.

const FALLBACK_SAYINGS = [
  { text: "고진감래 (苦盡甘來)", meaning: "쓴 것이 다하면 단 것이 온다는 뜻으로, 고생 끝에 낙이 옴" },
  { text: "티끌 모아 태산", meaning: "작은 것도 꾸준히 모으면 큰 것이 됨" },
  { text: "일석이조 (一石二鳥)", meaning: "한 가지 일로 두 가지 이익을 얻음" },
];

// 실제 이메일/비밀번호 로그인과 친구 고양이 실시간 만남은 Supabase(백엔드)로 처리합니다.
// config.js 에 프로젝트 URL/anon key를 넣어야 동작하며, 넣지 않으면 로그인 화면에 안내만 표시됩니다.
const isSupabaseConfigured =
  typeof SUPABASE_URL === "string" &&
  typeof SUPABASE_ANON_KEY === "string" &&
  !SUPABASE_URL.includes("YOUR-PROJECT") &&
  !SUPABASE_ANON_KEY.includes("YOUR-ANON");

const sb =
  isSupabaseConfigured && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

document.addEventListener("DOMContentLoaded", () => {
  const scene = document.getElementById("scene");
  const catWrap = document.getElementById("cat-wrap");
  const catFlip = document.getElementById("cat-flip");
  const cat = document.getElementById("cat");
  const catNameTag = document.getElementById("cat-name-tag");
  const toggleBackgroundBtn = document.getElementById("toggle-background");
  const statusBar = document.getElementById("status-bar");
  const speechBubble = document.getElementById("speech-bubble");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const fortuneSpot = document.getElementById("fortune-spot");
  const hungerValueEl = document.getElementById("hunger-value");
  const affectionValueEl = document.getElementById("affection-value");
  const hungerPipsEl = document.getElementById("hunger-pips");
  const affectionPipsEl = document.getElementById("affection-pips");
  const currentUserLabel = document.getElementById("current-user-label");
  const onlineCountEl = document.getElementById("online-count");

  const loginOverlay = document.getElementById("login-overlay");
  const loginForm = document.getElementById("login-form");
  const loginConfigWarning = document.getElementById("login-config-warning");
  const loginSubtitle = document.getElementById("login-subtitle");
  const loginEmailInput = document.getElementById("login-email");
  const loginPasswordInput = document.getElementById("login-password");
  const loginError = document.getElementById("login-error");
  const loginSubmitBtn = document.getElementById("login-submit");
  const loginToggleModeBtn = document.getElementById("login-toggle-mode");
  const switchUserBtn = document.getElementById("switch-user");

  const settingsOverlay = document.getElementById("settings-overlay");
  const openSettingsBtn = document.getElementById("open-settings");
  const closeSettingsBtn = document.getElementById("close-settings");
  const catNameInput = document.getElementById("cat-name-input");
  const skinButtons = [...document.querySelectorAll(".skin-option")];
  const recordSoundBtn = document.getElementById("record-sound-btn");
  const previewSoundBtn = document.getElementById("preview-sound-btn");
  const resetSoundBtn = document.getElementById("reset-sound-btn");
  const soundStatusEl = document.getElementById("sound-status");

  // ---------- Phase 1: 배경 전환 (기본 / bg-nature / bg-twilight 3종을 순서대로) ----------
  const BACKGROUND_CLASSES = [null, "bg-nature", "bg-twilight"];
  let backgroundIndex = 0;
  toggleBackgroundBtn.addEventListener("click", () => {
    backgroundIndex = (backgroundIndex + 1) % BACKGROUND_CLASSES.length;
    scene.classList.remove("bg-nature", "bg-twilight");
    const next = BACKGROUND_CLASSES[backgroundIndex];
    if (next) scene.classList.add(next);
  });

  // ---------- 사용자별 데이터 (Supabase auth + "cats" 테이블에 저장) ----------
  let currentUser = null; // Supabase auth user 객체 ({ id, email, ... })
  let hunger = 5;
  let affection = 5;
  let catName = "냥이";
  let skin = "white";
  let lastDate = new Date().toDateString();
  let footstepSoundDataUrl = null; // 사용자가 녹음한 발걸음 효과음 (data: URL)

  async function loadOrCreateCatRow(userId) {
    const { data, error } = await sb.from("cats").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (data) return data;

    const fresh = {
      user_id: userId,
      cat_name: "냥이",
      skin: "white",
      hunger: 5,
      affection: 5,
      last_date: new Date().toDateString(),
      footstep_sound: null,
    };
    const { error: insertError } = await sb.from("cats").insert(fresh);
    if (insertError) throw insertError;
    return fresh;
  }

  async function saveUserState() {
    if (!currentUser || !sb) return;
    try {
      await sb
        .from("cats")
        .update({ cat_name: catName, skin, hunger, affection, last_date: lastDate, footstep_sound: footstepSoundDataUrl })
        .eq("user_id", currentUser.id);
    } catch (err) {
      console.warn("저장 실패", err);
    }
  }

  // ---------- 사자성어/속담 데이터 ----------
  let sayings = FALLBACK_SAYINGS;
  fetch("assets/data/sayings.json")
    .then((res) => res.json())
    .then((data) => {
      if (Array.isArray(data) && data.length) sayings = data;
    })
    .catch(() => {
      /* 정적 서버 없이 file://로 열었을 때 등은 FALLBACK_SAYINGS 사용 */
    });

  function getRandomSaying() {
    return sayings[Math.floor(Math.random() * sayings.length)];
  }

  // ---------- 운세 지점(🥠): 매번 새로 뽑히는 운세 ----------
  const FORTUNE_LOVE = ["최고예요 💕", "따뜻해요 😽", "잔잔하게 좋아요", "빠르게 오르는 중이에요", "폭발적이에요 😻"];
  const FORTUNE_CAUTION = ["낮잠 과다", "간식 과식", "혼자만의 시간 부족", "발톱 정리 깜빡", "창밖 멍때리기", "츄르 중독"];
  const FORTUNE_COLOR = ["파랑", "노랑", "분홍", "초록", "보라", "주황", "하양"];

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function getRandomFortune() {
    return {
      love: pickRandom(FORTUNE_LOVE),
      caution: pickRandom(FORTUNE_CAUTION),
      color: pickRandom(FORTUNE_COLOR),
    };
  }

  function showFortune(anchorEl) {
    const f = getRandomFortune();
    showBubble(
      `🥠 오늘의 운세<br>오늘은 애정운이 ${f.love}<br>오늘은 ${f.caution}을 조심하세요<br>오늘은 ${f.color}이 잘 어울려요`,
      5000,
      anchorEl
    );
  }

  // ---------- 상태바 UI ----------
  function buildPips(container) {
    container.innerHTML = "";
    for (let i = 0; i < 5; i++) container.appendChild(document.createElement("span"));
  }
  function setPips(container, value) {
    [...container.children].forEach((el, i) => el.classList.toggle("filled", i < value));
  }
  buildPips(hungerPipsEl);
  buildPips(affectionPipsEl);

  function updateStatusBar() {
    hungerValueEl.textContent = hunger;
    affectionValueEl.textContent = affection;
    setPips(hungerPipsEl, hunger);
    setPips(affectionPipsEl, affection);
  }

  function updateNameTag() {
    catNameTag.textContent = catName;
    catNameTag.classList.toggle("hidden", !catName);
  }

  function setSkin(name, persist = true) {
    skin = name;
    cat.classList.remove("skin-white", "skin-cheese", "skin-black");
    cat.classList.add(`skin-${name}`);
    skinButtons.forEach((btn) => btn.classList.toggle("selected", btn.dataset.skin === name));
    if (persist) saveUserState();
  }

  // ---------- 말풍선 / 이펙트 ----------
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function showBubbleOn(bubbleEl, html, ms, anchorEl) {
    bubbleEl.innerHTML = html;
    bubbleEl.classList.remove("hidden");
    const anchorRect = anchorEl.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    bubbleEl.style.left = `${anchorRect.left - sceneRect.left + anchorRect.width / 2}px`;
    bubbleEl.style.top = `${anchorRect.top - sceneRect.top - 10}px`;
    bubbleEl.style.transform = "translate(-50%, -100%)";

    // 운세 지점처럼 화면 가장자리(특히 우측 하단)에 있으면 말풍선이 화면 밖으로
    // 잘려나가므로, 실제로 그려진 크기를 재서 안쪽으로 밀어줌
    const margin = 8;
    const bubbleRect = bubbleEl.getBoundingClientRect();
    let shiftX = 0;
    if (bubbleRect.left < sceneRect.left + margin) shiftX = sceneRect.left + margin - bubbleRect.left;
    else if (bubbleRect.right > sceneRect.right - margin) shiftX = sceneRect.right - margin - bubbleRect.right;
    if (shiftX) bubbleEl.style.transform = `translate(calc(-50% + ${shiftX}px), -100%)`;

    return setTimeout(() => bubbleEl.classList.add("hidden"), ms);
  }

  let bubbleTimer;
  function showBubble(html, ms = 2600, anchorEl = catWrap) {
    clearTimeout(bubbleTimer);
    bubbleTimer = showBubbleOn(speechBubble, html, ms, anchorEl);
  }

  function spawnFloatText(text, anchorEl = catWrap) {
    const el = document.createElement("div");
    el.className = "float-pop";
    el.textContent = text;
    const wrapRect = anchorEl.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    el.style.left = `${wrapRect.left - sceneRect.left + wrapRect.width / 2}px`;
    el.style.top = `${wrapRect.top - sceneRect.top}px`;
    scene.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  // 효과음: 실제 음원 파일이 없어 Web Audio로 합성한 임시(placeholder) 소리
  let audioCtx;
  function ensureAudio() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  // 걸을 때마다 나는 발걸음 효과음: 사용자가 녹음한 소리가 있으면 그걸 쓰고,
  // 없으면 귀여운 레트로 "뾱뾱" 합성음을 씀
  let footstepAudioEl = null;
  function playFootstepSynth() {
    const ctx = ensureAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    const base = 520 + Math.random() * 90;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.4, now + 0.05);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  function playFootstep() {
    if (footstepSoundDataUrl) {
      if (!footstepAudioEl) footstepAudioEl = new Audio();
      if (footstepAudioEl.src !== footstepSoundDataUrl) footstepAudioEl.src = footstepSoundDataUrl;
      footstepAudioEl.currentTime = 0;
      footstepAudioEl.play().catch(() => {});
      return;
    }
    playFootstepSynth();
  }

  // 친구 고양이가 걸을 때 나는 발걸음 소리: 그 친구가 녹음한 소리가 있으면 그걸, 없으면 기본 합성음
  const remoteFootstepAudio = new Map(); // userId -> Audio
  function playRemoteFootstep(userId) {
    const soundUrl = remoteSounds.get(userId);
    if (soundUrl) {
      let audioEl = remoteFootstepAudio.get(userId);
      if (!audioEl) {
        audioEl = new Audio();
        remoteFootstepAudio.set(userId, audioEl);
      }
      if (audioEl.src !== soundUrl) audioEl.src = soundUrl;
      audioEl.currentTime = 0;
      audioEl.play().catch(() => {});
      return;
    }
    playFootstepSynth();
  }

  function playMeow() {
    const ctx = ensureAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.3);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // ---------- Phase 4: 클릭 상호작용 (매번 랜덤) ----------
  function handleClickReaction() {
    const pick = ["meow", "saying", "heart"][Math.floor(Math.random() * 3)];
    if (pick === "meow") {
      playMeow();
      showBubble("야옹~ 🐾", 1200);
    } else if (pick === "saying") {
      const s = getRandomSaying();
      showBubble(`<strong>${s.text}</strong><br>${s.meaning}`, 3200);
    } else {
      spawnFloatText("💗");
      affection = clamp(affection + 1, 1, 5);
      updateStatusBar();
      saveUserState();
    }
  }

  // ---------- Phase 2/3: 고양이 이동 / 정지 / 그루밍 / 웅크림 ----------
  const WALK_SPEED = 70; // px/sec
  const MIN_IDLE_MS = 1200;
  const MAX_IDLE_MS = 3000;
  const GROOM_CHANCE = 0.3;

  let pos = { x: 0, y: 0 };
  let aiTimer = null;
  let crouched = false;
  let footstepTimer = null;
  const FOOTSTEP_INTERVAL_MS = 350;

  function walkTick() {
    playFootstep();
    dropFootprint();
  }

  function setCatState(name) {
    cat.classList.remove("state-idle", "state-walk", "state-groom", "state-crouch");
    cat.classList.add(`state-${name}`);
    if (name === "walk") {
      if (!footstepTimer) {
        walkTick();
        footstepTimer = setInterval(walkTick, FOOTSTEP_INTERVAL_MS);
      }
    } else if (footstepTimer) {
      clearInterval(footstepTimer);
      footstepTimer = null;
    }
  }

  function getSceneBounds(width, height) {
    const statusBarHeight = statusBar.offsetHeight;
    return {
      minX: 0,
      minY: statusBarHeight,
      maxX: Math.max(0, scene.clientWidth - width),
      maxY: Math.max(statusBarHeight, scene.clientHeight - height),
    };
  }
  function getBounds() {
    return getSceneBounds(catWrap.offsetWidth, catWrap.offsetHeight);
  }

  function setPosition(x, y) {
    pos = { x, y };
    catWrap.style.left = `${x}px`;
    catWrap.style.top = `${y}px`;
  }

  // 걸을 때마다(발걸음 소리와 같은 타이밍) 뒤에 남았다가 옅어지며 사라지는 발자국 흔적
  let footprintSide = 1;

  function dropFootprint() {
    const el = document.createElement("div");
    el.className = "footprint";
    footprintSide *= -1;
    const wrapRect = catWrap.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    el.style.left = `${wrapRect.left - sceneRect.left + wrapRect.width / 2 + footprintSide * 10}px`;
    el.style.top = `${wrapRect.top - sceneRect.top + wrapRect.height - 6}px`;
    el.textContent = "🐾";
    scene.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  function randomPointInBounds() {
    const b = getBounds();
    return {
      x: b.minX + Math.random() * (b.maxX - b.minX),
      y: b.minY + Math.random() * (b.maxY - b.minY),
    };
  }

  function goIdle() {
    if (crouched) {
      setCatState("crouch");
      return;
    }
    setCatState(Math.random() < GROOM_CHANCE ? "groom" : "idle");
    clearTimeout(aiTimer);
    aiTimer = setTimeout(walkToRandomPoint, MIN_IDLE_MS + Math.random() * (MAX_IDLE_MS - MIN_IDLE_MS));
  }

  function walkToRandomPoint() {
    if (crouched) return;
    const target = randomPointInBounds();
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 4) {
      goIdle();
      return;
    }

    catFlip.classList.toggle("facing-right", dx > 0);
    setCatState("walk");

    const durationMs = (distance / WALK_SPEED) * 1000;
    catWrap.style.transition = `left ${durationMs}ms linear, top ${durationMs}ms linear`;

    requestAnimationFrame(() => setPosition(target.x, target.y));

    clearTimeout(aiTimer);
    aiTimer = setTimeout(goIdle, durationMs);
  }

  function resumeAI() {
    catWrap.style.transition = "";
    if (crouched) {
      setCatState("crouch");
      return;
    }
    goIdle();
  }

  // ---------- 방향키 직접 조작: 평소엔 랜덤으로 돌아다니다가, 방향키를 누르면 그쪽으로 이동 ----------
  const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  const MANUAL_SPEED = 150; // px/sec
  const pressedKeys = new Set();
  let manualControl = false;
  let manualRafId = null;
  let manualLastFrameTime = null;

  function manualStep(timestamp) {
    if (manualLastFrameTime == null) manualLastFrameTime = timestamp;
    const dt = (timestamp - manualLastFrameTime) / 1000;
    manualLastFrameTime = timestamp;

    if (!crouched) {
      let dx = 0;
      let dy = 0;
      if (pressedKeys.has("ArrowUp")) dy -= 1;
      if (pressedKeys.has("ArrowDown")) dy += 1;
      if (pressedKeys.has("ArrowLeft")) dx -= 1;
      if (pressedKeys.has("ArrowRight")) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        const bounds = getBounds();
        const nx = clamp(pos.x + dx * MANUAL_SPEED * dt, bounds.minX, bounds.maxX);
        const ny = clamp(pos.y + dy * MANUAL_SPEED * dt, bounds.minY, bounds.maxY);
        if (dx !== 0) catFlip.classList.toggle("facing-right", dx > 0);
        setCatState("walk");
        setPosition(nx, ny);
      } else {
        setCatState(cat.classList.contains("state-groom") ? "groom" : "idle");
      }
    }

    if (manualControl) manualRafId = requestAnimationFrame(manualStep);
  }

  function startManualControl() {
    manualControl = true;
    manualLastFrameTime = null;
    clearTimeout(aiTimer);
    catWrap.style.transition = "none";
    manualRafId = requestAnimationFrame(manualStep);
  }

  function stopManualControl() {
    manualControl = false;
    if (manualRafId) cancelAnimationFrame(manualRafId);
    manualRafId = null;
    resumeAI();
  }

  window.addEventListener("keydown", (e) => {
    if (!ARROW_KEYS.includes(e.key)) return;
    if (!currentUser) return;
    if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    e.preventDefault();
    if (!pressedKeys.has(e.key)) {
      pressedKeys.add(e.key);
      if (!manualControl) startManualControl();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (!ARROW_KEYS.includes(e.key)) return;
    pressedKeys.delete(e.key);
    if (pressedKeys.size === 0 && manualControl) stopManualControl();
  });

  window.addEventListener("blur", () => {
    pressedKeys.clear();
    if (manualControl) stopManualControl();
  });

  // ---------- Phase 5: 배고픔에 따른 웅크림 상태 전환 ----------
  function applyHungerEffects() {
    const nowCrouched = hunger < 3;
    if (nowCrouched && !crouched) {
      crouched = true;
      clearTimeout(aiTimer);
      catWrap.style.transition = "none";
      setCatState("crouch");
    } else if (!nowCrouched && crouched) {
      crouched = false;
      goIdle();
    }
  }

  // ---------- 드래그 공용 헬퍼 ----------
  function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function attachDrag(el, { getBoundsFn, onStart, onMove, onEnd }) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      const sceneRect = scene.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offsetX = e.clientX - elRect.left;
      const offsetY = e.clientY - elRect.top;
      const startX = e.clientX;
      const startY = e.clientY;
      const startTime = performance.now();
      let moved = false;
      let totalPath = 0;
      let prevX = startX;
      let prevY = startY;
      onStart?.();

      function onPointerMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.hypot(dx, dy) > 5) moved = true;
        totalPath += Math.hypot(ev.clientX - prevX, ev.clientY - prevY);
        prevX = ev.clientX;
        prevY = ev.clientY;
        if (!moved) return;
        const bounds = getBoundsFn();
        const x = clamp(ev.clientX - sceneRect.left - offsetX, bounds.minX, bounds.maxX);
        const y = clamp(ev.clientY - sceneRect.top - offsetY, bounds.minY, bounds.maxY);
        onMove(x, y);
      }
      function onPointerUp(ev) {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        const durationMs = performance.now() - startTime;
        const displacement = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        onEnd(moved, { durationMs, totalPath, displacement });
      }
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });
  }

  // 고양이 드래그: 클릭이면 랜덤 반응, 드래그면 이동(-배고픔), 운세 지점에 놓으면 오늘의 한마디,
  // 3초 이상 + 마구 흔들면(이동 경로가 실제 변위보다 훨씬 길면) 배고픔/애정 랜덤 페널티
  attachDrag(catWrap, {
    getBoundsFn: getBounds,
    onStart() {
      clearTimeout(aiTimer);
      catWrap.style.transition = "none";
    },
    onMove(x, y) {
      setPosition(x, y);
    },
    onEnd(moved, dragInfo) {
      if (!moved) {
        handleClickReaction();
        resumeAI();
        return;
      }

      const shakeFactor = dragInfo.totalPath / (dragInfo.displacement + 1);
      const isShaken = dragInfo.durationMs >= 3000 && dragInfo.totalPath >= 500 && shakeFactor >= 3;

      if (isShaken) {
        const hungerLoss = 1 + Math.floor(Math.random() * 3);
        const affectionLoss = 1 + Math.floor(Math.random() * 3);
        hunger = clamp(hunger - hungerLoss, 1, 5);
        affection = clamp(affection - affectionLoss, 1, 5);
        spawnFloatText(`😿 -${hungerLoss} -${affectionLoss}💗`);
        showBubble("그만 흔들어줘... 냥 😾", 2000);
      } else {
        hunger = clamp(hunger - 1, 1, 5);
        if (rectsOverlap(catWrap.getBoundingClientRect(), fortuneSpot.getBoundingClientRect())) {
          showFortune(catWrap);
        }
      }
      applyHungerEffects();
      updateStatusBar();
      saveUserState();
      resumeAI();
    },
  });

  // ---------- Phase 5: 참치캔 스폰 & 드래그로 먹이 주기 ----------
  const CAN_COUNT = 4;
  let cans = [];

  function randomCanPosition() {
    const b = getSceneBounds(36, 36);
    return {
      x: b.minX + Math.random() * (b.maxX - b.minX),
      y: b.minY + Math.random() * (b.maxY - b.minY),
    };
  }

  function makeCanDraggable(can) {
    attachDrag(can.el, {
      getBoundsFn: () => getSceneBounds(can.el.offsetWidth, can.el.offsetHeight),
      onStart() {
        can.el.classList.add("dragging");
      },
      onMove(x, y) {
        can.el.style.left = `${x}px`;
        can.el.style.top = `${y}px`;
      },
      onEnd() {
        can.el.classList.remove("dragging");
        const canRect = can.el.getBoundingClientRect();
        if (rectsOverlap(canRect, catWrap.getBoundingClientRect())) {
          hunger = clamp(hunger + 1, 1, 5);
          spawnFloatText("+1 🐟");
          applyHungerEffects();
          updateStatusBar();
          saveUserState();
          removeCan(can);
          spawnCan();
          return;
        }
        for (const [userId, entry] of remoteCats) {
          if (rectsOverlap(canRect, entry.wrapEl.getBoundingClientRect())) {
            feedRemoteCat(userId, entry.wrapEl);
            removeCan(can);
            spawnCan();
            return;
          }
        }
      },
    });
  }

  function spawnCan() {
    const el = document.createElement("div");
    el.className = "tuna-can";
    el.textContent = "🥫";
    const p = randomCanPosition();
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    scene.appendChild(el);
    const can = { el };
    makeCanDraggable(can);
    cans.push(can);
  }

  function removeCan(can) {
    can.el.remove();
    cans = cans.filter((c) => c !== can);
  }

  function ensureCans() {
    while (cans.length < CAN_COUNT) spawnCan();
  }

  // ---------- 운세 지점: 클릭해도, 고양이를 드래그해서 데려다놔도 오늘의 운세 ----------
  fortuneSpot.addEventListener("click", () => {
    showFortune(fortuneSpot);
  });

  // ---------- 설정 모달: 고양이 이름 / 스킨 ----------
  function updateSoundStatus() {
    soundStatusEl.textContent = footstepSoundDataUrl ? "🎵 내 목소리로 녹음된 효과음 사용 중" : "기본 효과음 사용 중";
    previewSoundBtn.disabled = !footstepSoundDataUrl;
    resetSoundBtn.disabled = !footstepSoundDataUrl;
  }

  openSettingsBtn.addEventListener("click", () => {
    catNameInput.value = catName;
    updateSoundStatus();
    settingsOverlay.classList.remove("hidden");
  });
  closeSettingsBtn.addEventListener("click", () => {
    settingsOverlay.classList.add("hidden");
  });
  catNameInput.addEventListener("input", () => {
    catName = catNameInput.value.trim().slice(0, 8);
    updateNameTag();
    saveUserState();
  });
  skinButtons.forEach((btn) => {
    btn.addEventListener("click", () => setSkin(btn.dataset.skin));
  });

  // ---------- 발걸음 효과음 녹음 (마이크) ----------
  // 발걸음 소리는 걸을 때마다(0.35초 간격) 처음부터 다시 재생되므로 그 이상 길게
  // 녹음해도 실제로 들리진 않음. 대신 친구에게 그대로 전송되는 데이터라 너무 길면
  // 멀티플레이가 버벅여서(대용량 전송) 5초로 제한 — 그 안에서는 버튼으로 자유롭게 멈춤.
  const MAX_RECORD_MS = 5000;
  let mediaRecorder = null;
  let recordTimer = null;
  let recordTickTimer = null;
  let recordStartedAt = 0;

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      soundStatusEl.textContent = "이 브라우저에서는 녹음을 지원하지 않아요.";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        footstepSoundDataUrl = await blobToDataUrl(blob);
        updateSoundStatus();
        saveUserState();
        broadcastFootstepSound();
      };
      mediaRecorder.start();
      recordSoundBtn.textContent = "⏹ 녹음 중지";
      recordSoundBtn.classList.add("recording");
      recordStartedAt = Date.now();
      soundStatusEl.textContent = "녹음 중... 0초 (원하는 만큼 녹음하고 버튼을 눌러 멈추세요)";
      recordTickTimer = setInterval(() => {
        const sec = Math.floor((Date.now() - recordStartedAt) / 1000);
        soundStatusEl.textContent = `녹음 중... ${sec}초 (버튼을 누르면 멈춰요)`;
      }, 200);
      recordTimer = setTimeout(stopRecording, MAX_RECORD_MS);
    } catch (err) {
      soundStatusEl.textContent = "마이크 권한이 필요해요.";
    }
  }

  function stopRecording() {
    clearTimeout(recordTimer);
    clearInterval(recordTickTimer);
    recordTickTimer = null;
    recordSoundBtn.textContent = "🎙️ 녹음하기";
    recordSoundBtn.classList.remove("recording");
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  }

  recordSoundBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  });

  previewSoundBtn.addEventListener("click", () => {
    if (footstepSoundDataUrl) new Audio(footstepSoundDataUrl).play().catch(() => {});
  });

  resetSoundBtn.addEventListener("click", () => {
    footstepSoundDataUrl = null;
    footstepAudioEl = null;
    updateSoundStatus();
    saveUserState();
    broadcastFootstepSound();
  });

  // ---------- 친구 고양이 실시간 만남: 자체 Python(FastAPI) 서버, Render에 배포 ----------
  let rtSocket = null;
  let rtBroadcastStarted = false;
  const remoteCats = new Map(); // userId -> { wrapEl, nameEl, flipEl, spriteEl, lastX, lastY }
  const remoteSounds = new Map(); // userId -> 녹음된 발걸음 소리 dataUrl | null(기본 합성음)
  const PRESENCE_INTERVAL_MS = 400;
  const isRealtimeConfigured =
    typeof REALTIME_WS_URL === "string" && REALTIME_WS_URL && !REALTIME_WS_URL.includes("YOUR-RENDER-URL");

  function updateOnlineCount() {
    onlineCountEl.textContent = `🌐 온라인 ${remoteCats.size + 1}마리`;
  }

  function upsertRemoteCat(userId, info) {
    let entry = remoteCats.get(userId);
    if (!entry) {
      const wrap = document.createElement("div");
      wrap.className = "cat-wrap remote-cat";
      wrap.innerHTML =
        '<div class="cat-name-tag"></div><div class="cat-flip"><div class="cat-sprite state-idle"></div></div>' +
        '<div class="speech-bubble hidden"></div>';
      scene.appendChild(wrap);
      entry = {
        wrapEl: wrap,
        nameEl: wrap.querySelector(".cat-name-tag"),
        flipEl: wrap.querySelector(".cat-flip"),
        spriteEl: wrap.querySelector(".cat-sprite"),
        bubbleEl: wrap.querySelector(".speech-bubble"),
        bubbleTimer: null,
        lastX: info.x,
        lastY: info.y,
      };
      remoteCats.set(userId, entry);

      // 남의 고양이 괴롭히기: 3초 넘게 마구 흔들면 그 친구 배고픔이 1 줄어듦
      attachDrag(wrap, {
        getBoundsFn: getBounds,
        onStart() {
          wrap.style.transition = "none";
        },
        onMove(x, y) {
          wrap.style.left = `${x}px`;
          wrap.style.top = `${y}px`;
        },
        onEnd(moved, dragInfo) {
          wrap.style.transition = "";
          if (!moved) return;
          const shakeFactor = dragInfo.totalPath / (dragInfo.displacement + 1);
          const isShaken = dragInfo.durationMs >= 3000 && dragInfo.totalPath >= 500 && shakeFactor >= 3;
          if (isShaken) pokeRemoteCat(userId, entry.wrapEl);
        },
      });
    }

    const moved = Math.hypot(info.x - entry.lastX, info.y - entry.lastY) > 2;
    entry.spriteEl.className = `cat-sprite skin-${info.skin || "white"} ${moved ? "state-walk" : "state-idle"}`;
    entry.flipEl.classList.toggle("facing-right", info.facing === "right");
    entry.nameEl.textContent = info.name || "냥이";
    entry.wrapEl.style.left = `${info.x}px`;
    entry.wrapEl.style.top = `${info.y}px`;
    entry.lastX = info.x;
    entry.lastY = info.y;
    if (moved) playRemoteFootstep(userId);
  }

  function removeRemoteCat(userId) {
    const entry = remoteCats.get(userId);
    if (entry) {
      clearTimeout(entry.bubbleTimer);
      entry.wrapEl.remove();
      remoteCats.delete(userId);
    }
    remoteSounds.delete(userId);
    remoteFootstepAudio.delete(userId);
  }

  function showRemoteBubble(userId, text, ms = 3200) {
    const entry = remoteCats.get(userId);
    if (!entry) return;
    clearTimeout(entry.bubbleTimer);
    entry.bubbleEl.textContent = text;
    entry.bubbleEl.classList.remove("hidden");
    entry.bubbleTimer = setTimeout(() => entry.bubbleEl.classList.add("hidden"), ms);
  }

  // 재연결 시 예전 친구 목록이 유령처럼 남지 않도록 비우고, 서버가 보내주는 최신 목록으로 다시 채운다.
  function clearRemoteCats() {
    for (const id of [...remoteCats.keys()]) removeRemoteCat(id);
  }

  function broadcastPresence() {
    if (!rtSocket || rtSocket.readyState !== WebSocket.OPEN || !currentUser) return;
    rtSocket.send(
      JSON.stringify({
        type: "state",
        name: catName,
        skin,
        x: pos.x,
        y: pos.y,
        facing: catFlip.classList.contains("facing-right") ? "right" : "left",
      })
    );
  }

  function broadcastFootstepSound() {
    if (!rtSocket || rtSocket.readyState !== WebSocket.OPEN || !currentUser) return;
    rtSocket.send(JSON.stringify({ type: "sound", sound: footstepSoundDataUrl }));
  }

  function pokeRemoteCat(targetId, anchorEl) {
    if (!rtSocket || rtSocket.readyState !== WebSocket.OPEN) return;
    rtSocket.send(JSON.stringify({ type: "poke", target: targetId }));
    spawnFloatText("😾 흔들흔들!", anchorEl);
  }

  function feedRemoteCat(targetId, anchorEl) {
    if (!rtSocket || rtSocket.readyState !== WebSocket.OPEN) return;
    rtSocket.send(JSON.stringify({ type: "feed", target: targetId }));
    spawnFloatText("+1 🐟", anchorEl);
  }

  function broadcastChat(text) {
    if (!rtSocket || rtSocket.readyState !== WebSocket.OPEN || !currentUser) return;
    rtSocket.send(JSON.stringify({ type: "chat", text }));
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    showBubble(escapeHtml(text), 3200);
    broadcastChat(text);
    chatInput.value = "";
  });

  function connectRealtime() {
    if (!currentUser) return;
    if (!isRealtimeConfigured) {
      onlineCountEl.textContent = "🌐 멀티플레이 서버 미설정";
      return;
    }
    onlineCountEl.textContent = "🌐 연결 중...";
    const wsUrl = REALTIME_WS_URL.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
    rtSocket = new WebSocket(wsUrl);

    rtSocket.onopen = () => {
      console.log("[realtime] connected");
      clearRemoteCats();
      rtSocket.send(JSON.stringify({ type: "hello", id: currentUser.id }));
      broadcastPresence();
      broadcastFootstepSound();
      updateOnlineCount();
      if (!rtBroadcastStarted) {
        rtBroadcastStarted = true;
        setInterval(broadcastPresence, PRESENCE_INTERVAL_MS);
      }
    };

    rtSocket.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (err) {
        return;
      }
      if (!msg || msg.id === currentUser.id) return;
      if (msg.type === "state") {
        upsertRemoteCat(msg.id, msg);
        updateOnlineCount();
      } else if (msg.type === "sound") {
        remoteSounds.set(msg.id, msg.sound || null);
      } else if (msg.type === "chat") {
        showRemoteBubble(msg.id, msg.text || "");
      } else if (msg.type === "poke") {
        if (msg.target === currentUser.id) {
          hunger = clamp(hunger - 1, 1, 5);
          applyHungerEffects();
          updateStatusBar();
          saveUserState();
          spawnFloatText("😿 -1");
          showBubble("누가 나를 흔들었어! 😾", 2000);
        }
      } else if (msg.type === "feed") {
        if (msg.target === currentUser.id) {
          hunger = clamp(hunger + 1, 1, 5);
          applyHungerEffects();
          updateStatusBar();
          saveUserState();
          spawnFloatText("+1 🐟");
          showBubble("친구가 밥을 줬어! 🐟", 2000);
        }
      } else if (msg.type === "leave") {
        removeRemoteCat(msg.id);
        updateOnlineCount();
      }
    };

    rtSocket.onclose = () => {
      console.log("[realtime] closed, retrying in 3s");
      onlineCountEl.textContent = "🌐 연결 끊김, 재연결 중...";
      setTimeout(connectRealtime, 3000);
    };

    rtSocket.onerror = (err) => {
      console.log("[realtime] socket error", err);
    };
  }

  // ---------- 로그인: Supabase 이메일/비밀번호 실제 인증 ----------
  let authMode = "signin";

  loginToggleModeBtn.addEventListener("click", () => {
    authMode = authMode === "signin" ? "signup" : "signin";
    loginSubmitBtn.textContent = authMode === "signin" ? "로그인" : "회원가입";
    loginToggleModeBtn.textContent =
      authMode === "signin" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인";
    loginError.classList.add("hidden");
  });

  function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove("hidden");
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sb) return;
    loginError.classList.add("hidden");
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;
    loginSubmitBtn.disabled = true;
    try {
      const { data, error } =
        authMode === "signin"
          ? await sb.auth.signInWithPassword({ email, password })
          : await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (authMode === "signup" && !data.session) {
        showLoginError("가입 확인 이메일을 보냈어요. 메일함을 확인한 뒤 로그인해주세요.");
      }
      // 세션이 생기면 onAuthStateChange 가 감지해서 알아서 게임을 시작함
    } catch (err) {
      showLoginError(err.message || "로그인에 실패했어요.");
    } finally {
      loginSubmitBtn.disabled = false;
    }
  });

  switchUserBtn.addEventListener("click", async () => {
    if (sb) await sb.auth.signOut();
    location.reload();
  });

  // ---------- 세션 시작: Supabase 로그인 성공 시 내 고양이 데이터를 불러와 게임 시작 ----------
  async function startSession(user) {
    currentUser = user;
    try {
      const row = await loadOrCreateCatRow(user.id);
      const today = new Date().toDateString();
      hunger = row.last_date !== today ? 1 : row.hunger ?? 5; // PRD: 하루가 지나면 배고픔은 1로 리셋
      affection = row.affection ?? 5;
      catName = row.cat_name || "냥이";
      skin = row.skin || "white";
      footstepSoundDataUrl = row.footstep_sound || null;
      lastDate = today;
      await saveUserState();
    } catch (err) {
      showLoginError(err.message || "고양이 데이터를 불러오지 못했어요.");
      currentUser = null;
      return;
    }

    loginOverlay.classList.add("hidden");
    currentUserLabel.textContent = `🐾 ${user.email}`;
    updateNameTag();
    setSkin(skin, false);
    updateStatusBar();

    startGameLoop();
    connectRealtime();
  }

  function startGameLoop() {
    crouched = hunger < 3;
    ensureCans();
    const b = getBounds();
    setPosition((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
    if (crouched) {
      setCatState("crouch");
    } else {
      setTimeout(walkToRandomPoint, 800);
    }

    // 실시간 하루 경과 감지 (탭을 계속 켜둔 경우)
    setInterval(() => {
      const now = new Date().toDateString();
      if (now !== lastDate) {
        lastDate = now;
        hunger = 1;
        applyHungerEffects();
        updateStatusBar();
        saveUserState();
      }
    }, 60000);
  }

  // ---------- 초기화 ----------
  if (!sb) {
    loginConfigWarning.classList.remove("hidden");
    loginSubtitle.classList.add("hidden");
    loginEmailInput.disabled = true;
    loginPasswordInput.disabled = true;
    loginSubmitBtn.disabled = true;
    loginToggleModeBtn.disabled = true;
  } else {
    sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        if (!currentUser || currentUser.id !== session.user.id) startSession(session.user);
      } else {
        currentUser = null;
        loginOverlay.classList.remove("hidden");
      }
    });
  }
});
