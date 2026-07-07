const pages = Array.from(document.querySelectorAll(".page-section"));
const navLinks = Array.from(document.querySelectorAll("[data-page-link]"));
const siteNav = document.querySelector("#site-nav");
const menuToggle = document.querySelector(".menu-toggle");
let currentPrayerIndex = 0;
let isPrayerAnimating = false;

const prayers = [
  {
    title: "마음이 지친 날의 기도",
    body: "주님, 오늘 제 마음이 많이 지쳤습니다. 아무 말 하지 않아도 제 형편을 아시는 주님 앞에 조용히 머뭅니다. 제 안의 무거운 생각을 주님께 맡기오니, 다시 숨 쉴 힘과 평안을 허락해 주세요. 아멘."
  },
  {
    title: "가정을 위한 기도",
    body: "하나님 아버지, 우리 가정을 주님의 사랑 안에 붙들어 주세요. 서로를 이해하는 마음을 주시고, 말과 행동에 따뜻함이 흐르게 해 주세요. 작은 갈등보다 큰 사랑을 선택하는 가정이 되게 해 주세요. 아멘."
  },
  {
    title: "자녀를 위한 기도",
    body: "주님, 사랑하는 자녀의 길을 인도해 주세요. 세상의 기준보다 주님의 뜻을 따라 살게 하시고, 어려움 속에서도 정직과 믿음을 잃지 않게 해 주세요. 주님의 보호하심이 늘 함께하게 해 주세요. 아멘."
  },
  {
    title: "건강 회복을 위한 기도",
    body: "치유의 하나님, 연약한 몸과 마음을 불쌍히 여겨 주세요. 치료의 과정 가운데 낙심하지 않게 하시고, 필요한 사람과 도움을 만나게 해 주세요. 주님의 손길로 회복의 은혜를 경험하게 해 주세요. 아멘."
  },
  {
    title: "염려를 내려놓는 기도",
    body: "주님, 제 힘으로 붙들고 있던 염려를 내려놓습니다. 아직 보이지 않는 길 때문에 두려워하지 않게 하시고, 오늘 감당할 은혜를 먼저 바라보게 해 주세요. 주님께서 앞서 가심을 믿습니다. 아멘."
  },
  {
    title: "감사를 회복하는 기도",
    body: "하나님, 익숙해서 잊고 지냈던 은혜를 다시 보게 해 주세요. 작은 숨결, 따뜻한 말 한마디, 오늘의 식탁과 쉼까지 모두 주님의 선물임을 기억하게 해 주세요. 감사로 마음을 새롭게 해 주세요. 아멘."
  },
  {
    title: "관계를 위한 기도",
    body: "주님, 제 마음에 남아 있는 서운함과 상처를 만져 주세요. 먼저 이해하려는 마음을 주시고, 필요할 때 지혜롭게 말할 용기를 주세요. 관계 가운데 주님의 평화가 흐르게 해 주세요. 아멘."
  },
  {
    title: "결정을 앞둔 기도",
    body: "하나님 아버지, 중요한 선택 앞에서 제 욕심보다 주님의 뜻을 구하게 해 주세요. 조급함을 멈추고 말씀 안에서 분별하게 하시며, 어떤 길에서도 주님과 동행하는 믿음을 허락해 주세요. 아멘."
  },
  {
    title: "외로운 마음을 위한 기도",
    body: "주님, 외로움이 깊어지는 순간에도 제가 혼자가 아님을 알게 해 주세요. 주님의 임재가 제 마음 가까이에 있음을 느끼게 하시고, 위로가 필요한 오늘을 따뜻하게 감싸 주세요. 아멘."
  },
  {
    title: "하루를 마치는 기도",
    body: "사랑의 주님, 오늘 하루도 지켜 주셔서 감사합니다. 부족했던 말과 행동은 주님의 은혜로 덮어 주시고, 잘한 일에는 교만하지 않게 해 주세요. 평안한 밤을 허락해 주세요. 아멘."
  }
];

function showPage(pageId, options = {}) {
  const targetId = pageId || "home";
  const shouldUpdateHistory = options.updateHistory !== false;
  pages.forEach((page) => {
    page.classList.toggle("active", page.dataset.page === targetId);
  });

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.pageLink === targetId);
  });

  if (siteNav) {
    siteNav.classList.remove("open");
  }

  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", "false");
  }

  if (shouldUpdateHistory && window.location.hash !== `#${targetId}`) {
    window.history.pushState(null, "", `#${targetId}`);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
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
  updatePrayerCard();

  const prevButton = document.querySelector("#prayer-prev");
  const nextButton = document.querySelector("#prayer-next");

  if (prevButton) {
    prevButton.addEventListener("click", () => movePrayerCard("prev"));
  }

  if (nextButton) {
    nextButton.addEventListener("click", () => movePrayerCard("next"));
  }
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

  messageBox.textContent = "프리미엄 PDF는 현재 준비 중입니다. 결제 기능은 추후 연결될 예정입니다.";
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
  bindNavigation();
  handleForm("#prayer-form", "#prayer-form-message", "기도 제목이 접수된 것처럼 표시되었습니다. 현재 MVP에서는 서버에 저장되지 않습니다.");
  handleForm("#contact-form", "#contact-form-message", "문의가 접수된 것처럼 표시되었습니다. 실제 이메일 전송 기능은 추후 연결됩니다.");

  const premiumButton = document.querySelector("#premium-button");
  if (premiumButton) {
    premiumButton.addEventListener("click", handlePremiumPurchase);
  }

  const initialPage = window.location.hash.replace("#", "") || "home";
  const knownPage = pages.some((page) => page.dataset.page === initialPage);
  showPage(knownPage ? initialPage : "home", { updateHistory: false });
}

init();
