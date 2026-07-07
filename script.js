const pages = Array.from(document.querySelectorAll(".page-section"));
const navLinks = Array.from(document.querySelectorAll("[data-page-link]"));
const siteNav = document.querySelector("#site-nav");
const menuToggle = document.querySelector(".menu-toggle");
let currentPrayerIndex = 0;
let isPrayerAnimating = false;

const dailyStartDate = new Date("2026-07-07T00:00:00+09:00");

const dailyContent = {
  today: [
    {
      title: "마음이 지친 날의 기도",
      verse: "마태복음 11장 28절",
      body: "주님, 오늘 제 마음이 많이 지쳤습니다. 아무 말 하지 않아도 제 형편을 아시는 주님 앞에 조용히 머뭅니다. 제 안의 무거운 생각을 주님께 맡기오니, 다시 숨 쉴 힘과 평안을 허락해 주세요. 아멘."
    },
    {
      title: "가정을 위한 기도",
      verse: "여호수아 24장 15절",
      body: "하나님 아버지, 우리 가정을 주님의 사랑 안에 붙들어 주세요. 서로를 이해하는 마음을 주시고 말과 행동에 따뜻함이 흐르게 해 주세요. 작은 갈등보다 큰 사랑을 선택하는 가정이 되게 해 주세요. 아멘."
    },
    {
      title: "자녀를 위한 기도",
      verse: "잠언 22장 6절",
      body: "주님, 사랑하는 자녀의 길을 인도해 주세요. 세상의 기준보다 주님의 뜻을 따라 살게 하시고, 어려움 속에서도 정직과 믿음을 잃지 않게 해 주세요. 주님의 보호하심이 늘 함께하게 해 주세요. 아멘."
    },
    {
      title: "건강 회복을 위한 기도",
      verse: "이사야 53장 5절",
      body: "치유의 하나님, 연약한 몸과 마음을 불쌍히 여겨 주세요. 치료의 과정 가운데 낙심하지 않게 하시고, 필요한 사람과 도움을 만나게 해 주세요. 주님의 손길로 회복의 은혜를 경험하게 해 주세요. 아멘."
    },
    {
      title: "염려를 내려놓는 기도",
      verse: "베드로전서 5장 7절",
      body: "주님, 제 힘으로 붙들고 있던 염려를 내려놓습니다. 아직 보이지 않는 길 때문에 두려워하지 않게 하시고, 오늘 감당할 은혜를 먼저 바라보게 해 주세요. 주님께서 앞서 가심을 믿습니다. 아멘."
    },
    {
      title: "감사를 회복하는 기도",
      verse: "데살로니가전서 5장 18절",
      body: "하나님, 익숙해서 잊고 지냈던 은혜를 다시 보게 해 주세요. 작은 숨결, 따뜻한 말 한마디, 오늘의 식탁과 쉼까지 모두 주님의 선물임을 기억하게 해 주세요. 감사로 마음을 새롭게 해 주세요. 아멘."
    },
    {
      title: "관계를 위한 기도",
      verse: "로마서 12장 18절",
      body: "주님, 제 마음에 남아 있는 서운함과 상처를 만져 주세요. 먼저 이해하려는 마음을 주시고, 필요할 때 지혜롭게 말할 용기를 주세요. 관계 가운데 주님의 평화가 흐르게 해 주세요. 아멘."
    },
    {
      title: "결정을 앞둔 기도",
      verse: "잠언 3장 5-6절",
      body: "하나님 아버지, 중요한 선택 앞에서 제 욕심보다 주님의 뜻을 구하게 해 주세요. 조급함을 멈추고 말씀 안에서 분별하게 하시며, 어떤 길에서도 주님과 동행하는 믿음을 허락해 주세요. 아멘."
    },
    {
      title: "외로운 마음을 위한 기도",
      verse: "시편 23장 4절",
      body: "주님, 외로움이 깊어지는 순간에도 제가 혼자가 아님을 알게 해 주세요. 주님의 임재가 제 마음 가까이에 있음을 느끼게 하시고, 위로가 필요한 오늘을 따뜻하게 감싸 주세요. 아멘."
    },
    {
      title: "하루를 마치는 기도",
      verse: "시편 4장 8절",
      body: "사랑의 주님, 오늘 하루도 지켜 주셔서 감사합니다. 부족했던 말과 행동은 주님의 은혜로 덮어 주시고, 잘한 일에는 교만하지 않게 해 주세요. 평안한 밤을 허락해 주세요. 아멘."
    }
  ],
  morning: [
    {
      title: "하루를 여는 감사와 보호의 기도",
      verse: "시편 118장 24절",
      body: "주님, 새 아침을 허락해 주셔서 감사합니다. 오늘이라는 선물을 기쁨으로 받게 하시고, 제 마음과 생각을 주님의 평안으로 지켜 주세요. 만나는 사람마다 따뜻한 말과 선한 태도로 대하게 하시며, 오늘의 걸음이 주님의 인도 안에 있게 해 주세요. 아멘."
    },
    {
      title: "오늘의 길을 맡기는 아침기도",
      verse: "잠언 16장 9절",
      body: "하나님 아버지, 사람이 마음으로 길을 계획해도 그 걸음을 인도하시는 분은 주님이심을 믿습니다. 오늘 제 계획이 흔들려도 낙심하지 않게 하시고, 보이지 않는 길에서도 주님의 손길을 신뢰하게 해 주세요. 아멘."
    },
    {
      title: "입술을 지키는 아침기도",
      verse: "시편 141장 3절",
      body: "주님, 오늘 제 입술에 파수꾼을 세워 주세요. 급한 말보다 은혜로운 말을 선택하게 하시고, 상처가 아니라 평안을 전하는 사람이 되게 해 주세요. 제 말과 침묵 모두 주님께 드립니다. 아멘."
    },
    {
      title: "마음과 생각을 지키는 아침기도",
      verse: "빌립보서 4장 7절",
      body: "주님, 오늘 제 마음과 생각을 그리스도 예수 안에서 지켜 주세요. 불편한 만남과 부담스러운 일을 앞두고 먼저 주님의 평강을 받게 하시며, 두려움보다 믿음으로 하루를 시작하게 해 주세요. 아멘."
    }
  ],
  night: [
    {
      title: "잠들기 전 마음을 맡기는 기도",
      verse: "시편 4장 8절",
      body: "주님, 오늘 하루의 염려와 후회를 주님 손에 맡깁니다. 잠드는 동안에도 제 마음을 지켜 주시고, 집과 가족 위에 평안을 덮어 주세요. 내일의 무게를 오늘 밤까지 끌어안지 않게 하시고 주님의 품 안에서 쉬게 해 주세요. 아멘."
    },
    {
      title: "염려를 내려놓는 밤기도",
      verse: "베드로전서 5장 7절",
      body: "주님, 내려놓고 싶은데 내려놓아지지 않는 염려를 주님께 가져옵니다. 제 손이 약해도 주님의 손은 능하심을 믿습니다. 오늘 밤 제 생각을 평안으로 덮으시고 깊은 쉼으로 인도해 주세요. 아멘."
    },
    {
      title: "상처받은 마음을 위한 밤기도",
      verse: "시편 147장 3절",
      body: "하나님, 낮에 들은 말과 마음에 남은 상처를 고쳐 주세요. 사람의 말에 찔린 마음을 붙잡고 잠들지 않게 하시고, 주님의 위로 안에서 제 영혼을 부드럽게 싸매 주세요. 아멘."
    },
    {
      title: "분노를 맡기는 밤기도",
      verse: "로마서 12장 19절",
      body: "주님, 억울함과 분노를 제 손으로 갚으려 하지 않겠습니다. 판단과 보응을 주님께 맡기며, 제 안의 끓는 마음을 평안으로 바꾸어 주세요. 복수의 생각이 아니라 주님의 쉼으로 잠들게 해 주세요. 아멘."
    }
  ],
  meditation: [
    {
      title: "목자 되신 주님을 묵상합니다",
      verse: "시편 23장 1절",
      body: "여호와는 나의 목자시니 내게 부족함이 없다는 고백은 상황이 넉넉해서가 아니라 주님이 나를 이끄시기 때문에 가능한 믿음의 선언입니다. 오늘 부족함이 느껴지는 자리에서 주님을 다시 목자로 고백해 보세요."
    },
    {
      title: "아버지 품의 안식을 묵상합니다",
      verse: "로마서 8장 15절",
      body: "우리는 다시 무서워하는 종의 영을 받은 사람이 아니라 하나님을 아버지라 부르는 자녀입니다. 더 완벽해야 사랑받는다는 부담을 내려놓고, 은혜로 품으시는 아버지께 마음을 기대어 보세요."
    },
    {
      title: "광야에서 빚으시는 하나님",
      verse: "이사야 43장 2절",
      body: "물 가운데로 지날 때에도 주님은 함께하십니다. 광야 같은 시간이 길어질수록 조급함은 커지지만, 하나님은 기다림 속에서도 우리를 빚으시고 보호하십니다. 오늘의 광야를 주님과 함께 걸어가세요."
    },
    {
      title: "내 손을 떠난 일도 주님의 손 안에",
      verse: "출애굽기 2장 3절",
      body: "요게벳이 갈대 상자에 모세를 맡겼던 순간은 포기가 아니라 믿음이었습니다. 내가 더 붙들 수 없는 일도 하나님의 손 안에서는 끝이 아닙니다. 오늘 맡겨야 할 일을 조용히 주님께 올려드리세요."
    }
  ]
};

const prayers = dailyContent.today.map(({ title, body, verse }) => ({ title, body, verse }));

function showPage(pageId, options = {}) {
  const targetId = pageId || "home";
  const shouldUpdateHistory = options.updateHistory !== false;
  pages.forEach((page) => {
    page.classList.toggle("active", page.dataset.page === targetId);
  });

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.pageLink === targetId);
  });

  if (siteNav) siteNav.classList.remove("open");
  if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");

  if (shouldUpdateHistory && window.location.hash !== `#${targetId}`) {
    window.history.pushState(null, "", `#${targetId}`);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getDaysSinceStart() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(dailyStartDate.getFullYear(), dailyStartDate.getMonth(), dailyStartDate.getDate());
  return Math.max(0, Math.floor((today - start) / 86400000));
}

function formatArchiveDate(offset) {
  const date = new Date(dailyStartDate);
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function getLoopedPrayerIndex(index) {
  return (index + prayers.length) % prayers.length;
}

function updatePrayerCard() {
  const card = document.querySelector("#prayer-card");
  const status = document.querySelector("#prayer-card-status");
  if (!card || !status) return;

  const prayer = prayers[currentPrayerIndex];
  card.innerHTML = `
    <p class="eyebrow">기도문 ${currentPrayerIndex + 1}</p>
    <h2>${prayer.title}</h2>
    <blockquote>${prayer.verse}</blockquote>
    <p>${prayer.body}</p>
  `;
  status.textContent = `기도문 ${currentPrayerIndex + 1} / ${prayers.length}`;
}

function movePrayerCard(direction) {
  const card = document.querySelector("#prayer-card");
  if (!card || isPrayerAnimating) return;

  isPrayerAnimating = true;
  const isNext = direction === "next";
  const outClass = isNext ? "slide-out-left" : "slide-out-right";
  const inClass = isNext ? "slide-in-right" : "slide-in-left";

  card.classList.remove("slide-in-right", "slide-in-left", "slide-out-left", "slide-out-right");
  card.classList.add(outClass);

  card.addEventListener("animationend", () => {
    currentPrayerIndex = getLoopedPrayerIndex(currentPrayerIndex + (isNext ? 1 : -1));
    updatePrayerCard();
    card.classList.remove(outClass);
    card.classList.add(inClass);

    card.addEventListener("animationend", () => {
      card.classList.remove(inClass);
      isPrayerAnimating = false;
    }, { once: true });
  }, { once: true });
}

function renderPrayers() {
  currentPrayerIndex = getDaysSinceStart() % prayers.length;
  updatePrayerCard();

  const prevButton = document.querySelector("#prayer-prev");
  const nextButton = document.querySelector("#prayer-next");
  if (prevButton) prevButton.addEventListener("click", () => movePrayerCard("prev"));
  if (nextButton) nextButton.addEventListener("click", () => movePrayerCard("next"));
}

function renderDailyArchive(sectionKey, archiveSelector, limit = 7) {
  const archive = document.querySelector(archiveSelector);
  const entries = dailyContent[sectionKey];
  if (!archive || !entries?.length) return;

  const daysSinceStart = getDaysSinceStart();
  const count = Math.min(daysSinceStart + 1, entries.length, limit);
  const cards = [];

  for (let i = 0; i < count; i += 1) {
    const offset = daysSinceStart - i;
    const entry = entries[offset % entries.length];
    cards.push(`
      <article class="daily-card">
        <p class="daily-date">${formatArchiveDate(offset)}</p>
        <h3>${entry.title}</h3>
        <blockquote>${entry.verse}</blockquote>
        <p>${entry.body}</p>
      </article>
    `);
  }

  archive.innerHTML = cards.join("");
}

function renderDailyFeature(sectionKey, targetSelector) {
  const target = document.querySelector(targetSelector);
  const entries = dailyContent[sectionKey];
  if (!target || !entries?.length) return;

  const entry = entries[getDaysSinceStart() % entries.length];
  target.innerHTML = `
    <article class="content-article daily-feature-card">
      <p class="eyebrow">오늘의 ${sectionKey === "morning" ? "아침기도" : sectionKey === "night" ? "밤기도" : "말씀 묵상"}</p>
      <h2>${entry.title}</h2>
      <blockquote>${entry.verse}</blockquote>
      <p>${entry.body}</p>
    </article>
  `;
}

function renderDailyContent() {
  renderDailyArchive("today", "#today-archive", 7);
  renderDailyFeature("morning", "#morning-daily");
  renderDailyArchive("morning", "#morning-archive", 7);
  renderDailyFeature("night", "#night-daily");
  renderDailyArchive("night", "#night-archive", 7);
  renderDailyFeature("meditation", "#meditation-daily");
  renderDailyArchive("meditation", "#meditation-archive", 7);
}

function handleForm(formId, messageId, message) {
  const form = document.querySelector(formId);
  const messageBox = document.querySelector(messageId);
  if (!form || !messageBox) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.reset();
    messageBox.textContent = message;
  });
}

function handlePremiumPurchase() {
  const messageBox = document.querySelector("#premium-message");
  if (!messageBox) return;
  messageBox.textContent = "프리미엄 PDF는 현재 준비 중입니다. 출시 알림 기능과 결제 기능은 추후 연결될 예정입니다.";
}

function bindNavigation() {
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showPage(link.dataset.pageLink);
    });
  });

  if (menuToggle && siteNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  window.addEventListener("popstate", () => {
    const pageId = window.location.hash.replace("#", "") || "home";
    showPage(pageId, { updateHistory: false });
  });
}

function init() {
  renderPrayers();
  renderDailyContent();
  bindNavigation();
  handleForm("#prayer-form", "#prayer-form-message", "기도 제목이 접수된 것처럼 표시되었습니다. 현재 MVP에서는 서버에 저장되지 않습니다.");
  handleForm("#contact-form", "#contact-form-message", "문의가 접수된 것처럼 표시되었습니다. 실제 이메일 전송 기능은 추후 연결됩니다.");

  const premiumButton = document.querySelector("#premium-button");
  if (premiumButton) premiumButton.addEventListener("click", handlePremiumPurchase);

  const initialPage = window.location.hash.replace("#", "") || "home";
  const knownPage = pages.some((page) => page.dataset.page === initialPage);
  showPage(knownPage ? initialPage : "home", { updateHistory: false });
}

init();