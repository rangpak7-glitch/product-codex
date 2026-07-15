import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const channelId = process.env.YOUTUBE_CHANNEL_ID || "UCFrsilNKJ8xcmn0RUrFz6XQ";
const outputPath = resolve(import.meta.dirname, "..", "data", "videos.js");
const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
const userAgent = "Mozilla/5.0 (compatible; PrayerSpringVideoSync/1.0)";
const shortsPlaylists = [
  { title: "아침기도", id: "PLuSEbygGPaMhrkxuIbMatrxDjC9Uxmnvr" },
  { title: "저녁기도", id: "PLuSEbygGPaMiScyBR1TOLb7ZAuov7cX-E" },
  { title: "하루 한 말씀, 인생 회복", id: "PLuSEbygGPaMht5GW7sKoLYjpwFigkDeI-" }
];

async function fetchText(url, label) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8"
    }
  });
  if (!response.ok) throw new Error(`${label} 요청 실패: ${response.status}`);
  return response.text();
}

function loadExisting(source) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: "data/videos.js" });
  return Array.isArray(sandbox.window.VIDEOS) ? sandbox.window.VIDEOS : [];
}

function decodeXml(value = "") {
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  const text = cdata ? cdata[1] : value;
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function tagValue(source, tagName) {
  const match = source.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return decodeXml(match?.[1] || "");
}

function parseFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => {
    const entry = match[1];
    return {
      videoId: tagValue(entry, "yt:videoId"),
      title: tagValue(entry, "title"),
      description: tagValue(entry, "media:description"),
      publishedAt: tagValue(entry, "published"),
      publishedDate: tagValue(entry, "published").slice(0, 10)
    };
  }).filter((video) => /^[A-Za-z0-9_-]{11}$/.test(video.videoId) && video.title);
}

function mergeTags(tags, theme, isShort, text = "") {
  const baseTags = tags?.length ? tags : inferTags(text, theme, isShort);
  const withoutShorts = baseTags.filter((tag) => tag !== "Shorts");
  return [...new Set([...(isShort ? ["Shorts"] : []), ...withoutShorts])].slice(0, 5);
}

function inferTheme(text) {
  if (/아침/.test(text)) return "아침기도";
  if (/저녁|밤|잠|수면/.test(text)) return "저녁기도";
  if (/큐티|묵상|말씀|시편|복음/.test(text)) return "말씀묵상";
  if (/위로|회복/.test(text)) return "위로묵상";
  return "기도";
}

function inferTags(text, theme, isShort) {
  const candidates = ["불안", "평안", "감사", "자녀", "가정", "건강", "회복", "위로", "수면", "지혜", "선택", "관계", "용서", "기도", "말씀"];
  const tags = candidates.filter((tag) => text.includes(tag)).slice(0, 4);
  if (!tags.includes(theme)) tags.unshift(theme);
  if (isShort) tags.unshift("Shorts");
  return [...new Set(tags)].slice(0, 5);
}

function inferScripture(text) {
  const books = "창세기|출애굽기|레위기|민수기|신명기|여호수아|사사기|룻기|사무엘상|사무엘하|열왕기상|열왕기하|역대상|역대하|에스라|느헤미야|에스더|욥기|시편|잠언|전도서|아가|이사야|예레미야|예레미야애가|에스겔|다니엘|호세아|요엘|아모스|오바댜|요나|미가|나훔|하박국|스바냐|학개|스가랴|말라기|마태복음|마가복음|누가복음|요한복음|사도행전|로마서|고린도전서|고린도후서|갈라디아서|에베소서|빌립보서|골로새서|데살로니가전서|데살로니가후서|디모데전서|디모데후서|디도서|빌레몬서|히브리서|야고보서|베드로전서|베드로후서|요한일서|요한이서|요한삼서|유다서|요한계시록";
  const match = text.match(new RegExp(`(${books})\\s*(\\d+)(?:\\s*(편|장))?(?:\\s*(\\d+)\\s*절|:(\\d+(?:-\\d+)?))?`));
  if (!match) return "";
  const unit = match[3] || (match[1] === "시편" ? "편" : "장");
  const verse = match[4] || match[5] || "";
  return `${match[1]} ${match[2]}${unit}${verse ? ` ${verse}절` : ""}`;
}

function firstDescriptionLine(description) {
  return description.split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 240)
    || "기도의샘물 유튜브에 게시된 말씀과 기도 영상입니다.";
}

function archiveRecord(video, shortIds, playlistNamesByVideoId) {
  const knownPlaylistTitles = new Set(shortsPlaylists.map((playlist) => playlist.title));
  const preservedPlaylists = (video.shortsPlaylists || []).filter((title) => knownPlaylistTitles.has(title));
  const shortsPlaylistsForVideo = playlistNamesByVideoId.get(video.videoId) || preservedPlaylists;
  const isShort = shortIds.has(video.videoId) || shortsPlaylistsForVideo.length > 0;
  const theme = video.theme || inferTheme(video.title || "");
  return {
    id: video.id || `youtube-${video.videoId}`,
    videoId: video.videoId,
    title: video.title,
    theme,
    scripture: video.scripture || "",
    description: video.description || "기도의샘물 유튜브에 게시된 말씀과 기도 영상입니다.",
    tags: mergeTags(video.tags, theme, isShort, video.title || ""),
    publishedDate: video.publishedDate || "",
    publishedAt: video.publishedAt || (video.publishedDate ? `${video.publishedDate}T00:00:00Z` : ""),
    isShort,
    shortsPlaylists: shortsPlaylistsForVideo
  };
}

const existingSource = await readFile(outputPath, "utf8");
const existing = loadExisting(existingSource);
const existingByVideoId = new Map(existing.map((video) => [video.videoId, video]));
const [feedXml, ...playlistFeedXmls] = await Promise.all([
  fetchText(feedUrl, "YouTube 채널 RSS"),
  ...shortsPlaylists.map((playlist) => fetchText(
    `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlist.id)}`,
    `YouTube ${playlist.title} 재생목록 RSS`
  ))
]);
const feedVideos = parseFeed(feedXml);
const playlistNamesByVideoId = new Map();
const playlistVideos = playlistFeedXmls.flatMap((xml, index) => {
  const playlist = shortsPlaylists[index];
  const videos = parseFeed(xml);
  if (!videos.length) throw new Error(`${playlist.title} 재생목록이 비어 있어 기존 파일을 유지합니다.`);
  videos.forEach((video) => {
    const names = playlistNamesByVideoId.get(video.videoId) || [];
    playlistNamesByVideoId.set(video.videoId, [...new Set([...names, playlist.title])]);
  });
  return videos;
});
const shortIds = new Set(playlistNamesByVideoId.keys());

if (!feedVideos.length) throw new Error("공개 영상 데이터를 찾지 못해 기존 파일을 유지합니다.");
if (!shortIds.size) throw new Error("Shorts 재생목록 영상을 찾지 못해 기존 파일을 유지합니다.");

const mergedFeedVideos = new Map(feedVideos.map((video) => [video.videoId, video]));
playlistVideos.forEach((video) => {
  if (!mergedFeedVideos.has(video.videoId)) mergedFeedVideos.set(video.videoId, video);
});

const currentRecords = [...mergedFeedVideos.values()].map((video) => {
  const previous = existingByVideoId.get(video.videoId) || {};
  const isShort = shortIds.has(video.videoId);
  const text = `${video.title} ${video.description}`;
  const theme = previous.theme || inferTheme(text);
  return {
    id: previous.id || `youtube-${video.videoId}`,
    videoId: video.videoId,
    title: video.title,
    theme,
    scripture: previous.scripture || inferScripture(text),
    description: previous.description || firstDescriptionLine(video.description),
    tags: mergeTags(previous.tags, theme, isShort, text),
    publishedDate: video.publishedDate,
    publishedAt: video.publishedAt,
    isShort,
    shortsPlaylists: playlistNamesByVideoId.get(video.videoId) || []
  };
});

const currentIds = new Set(currentRecords.map((video) => video.videoId));
const archiveRecords = existing
  .filter((video) => /^[A-Za-z0-9_-]{11}$/.test(video.videoId) && !currentIds.has(video.videoId))
  .map((video) => archiveRecord(video, shortIds, playlistNamesByVideoId));
const records = [...currentRecords, ...archiveRecords]
  .sort((a, b) => String(b.publishedAt || b.publishedDate).localeCompare(String(a.publishedAt || a.publishedDate)))
  .slice(0, 60);

if (new Set(records.map((video) => video.videoId)).size !== records.length) throw new Error("중복 영상 ID가 있습니다.");
if (!records.some((video) => video.isShort)) throw new Error("Shorts로 분류된 영상이 없어 기존 파일을 유지합니다.");

const output = `window.VIDEOS = ${JSON.stringify(records, null, 2)}.map((video) => ({
  ...video,
  url: video.url || (video.isShort ? \`https://www.youtube.com/shorts/\${video.videoId}\` : \`https://www.youtube.com/watch?v=\${video.videoId}\`),
  thumbnail: video.thumbnail || \`https://i.ytimg.com/vi/\${video.videoId}/hqdefault.jpg\`
}));\n`;

if (output === existingSource) {
  console.log("YouTube 영상 데이터가 이미 최신입니다.");
} else {
  await writeFile(outputPath, output, "utf8");
  console.log(`YouTube 영상 ${records.length}개를 갱신했습니다. 3개 재생목록의 Shorts ${records.filter((video) => video.isShort).length}개를 포함합니다.`);
}
