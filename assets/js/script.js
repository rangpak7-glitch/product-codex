const $ = (selector) => document.querySelector(selector);

const toggle = $(".menu-toggle");
const nav = $("#site-nav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

function card(item) {
  return `<article class="content-card">
    <p class="eyebrow">${item.category || item.scripture || "Prayer"}</p>
    <strong>${item.title}</strong>
    <p>${item.summary || item.description || item.body}</p>
    ${item.scripture ? `<blockquote>${item.scripture}</blockquote>` : ""}
    ${item.body ? `<p>${item.body}</p>` : ""}
  </article>`;
}

function renderPrayers(list = PRAYERS) {
  const root = $("#prayerResults");
  if (!root) return;
  root.innerHTML = list.map(card).join("");
}

function searchPrayers() {
  const input = $("#prayerSearch");
  if (!input) return;
  const q = input.value.trim().toLowerCase();
  const list = q
    ? PRAYERS.filter((p) => [p.title, p.category, p.scripture, ...(p.tags || [])].join(" ").toLowerCase().includes(q))
    : PRAYERS;
  renderPrayers(list);
  const help = $("#searchHelp");
  if (help) help.textContent = list.length ? `${list.length}개의 기도문을 찾았습니다.` : "가까운 주제의 기도문을 다시 추천해 드립니다.";
}

if ($("#prayerResults")) {
  const params = new URLSearchParams(location.search);
  const q = params.get("q");
  if (q && $("#prayerSearch")) $("#prayerSearch").value = q;
  renderPrayers();
  searchPrayers();
}

$("[data-prayer-search]")?.addEventListener("click", searchPrayers);
$("#prayerSearch")?.addEventListener("input", searchPrayers);
$("[data-search-go]")?.addEventListener("click", () => {
  const q = $("#homeSearch")?.value.trim();
  location.href = q ? `prayers.html?q=${encodeURIComponent(q)}` : "prayers.html";
});

function renderList(id, list) {
  const root = document.getElementById(id);
  if (root) root.innerHTML = list.map(card).join("");
}

renderList("nightList", PRAYERS.filter((p) => p.tags?.includes("밤") || p.tags?.includes("수면") || p.category === "수면").concat(PRAYERS.slice(0, 4)));
renderList("morningList", PRAYERS.filter((p) => p.category === "아침").concat(PRAYERS.slice(1, 7)));
renderList("meditationList", MEDITATIONS);

function videoCard(v) {
  return `<article class="video-card">
    <div class="video-thumb">${v.theme}</div>
    <h3>${v.title}</h3>
    <p><strong>관련 말씀:</strong> ${v.scripture}</p>
    <p>${v.description}</p>
    <a class="button secondary" href="${v.url}" target="_blank" rel="noopener">영상 바로 보기</a>
  </article>`;
}
const videoList = $("#videoList");
if (videoList) videoList.innerHTML = VIDEOS.map(videoCard).join("");
const homeVideos = $("#homeVideos");
if (homeVideos) homeVideos.innerHTML = VIDEOS.slice(0, 3).map(videoCard).join("");

const prayerCardList = $("#prayerCardList");
if (prayerCardList) {
  prayerCardList.innerHTML = PRAYER_CARDS.map((c) => `<article class="content-card">
    <p class="eyebrow">${c.category}</p>
    <strong>${c.title}</strong>
    <p>${c.description}</p>
    <blockquote>${c.scripture}</blockquote>
    <p><strong>사용 예:</strong> ${c.useCase}</p>
    <a class="text-link" href="#cardPreview">카드 구성 보기</a>
  </article>`).join("");
}

const challengeList = $("#challengeList");
if (challengeList) {
  challengeList.innerHTML = PRAYER_CHALLENGE.map((d) => `<article class="day-card">
    <p class="eyebrow">Day ${d.day}</p>
    <strong>${d.title}</strong>
    <p>${d.scripture}</p>
    <p>${d.summary}</p>
    <a class="text-link" href="${d.detailUrl}">읽기</a>
  </article>`).join("");
}

const prayerForm = $("#prayerRequestForm");
if (prayerForm) {
  prayerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    prayerForm.querySelector(".form-message").textContent = "기도 제목을 확인했습니다. 함께 기도하는 마음으로 소중히 받겠습니다.";
    prayerForm.reset();
  });
}
