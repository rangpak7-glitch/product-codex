import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const apiKey = process.env.YOUTUBE_API_KEY;
const channelId = process.env.YOUTUBE_CHANNEL_ID || "UCFrsilNKJ8xcmn0RUrFz6XQ";
const outputPath = resolve(import.meta.dirname, "..", "data", "videos.js");

if (!apiKey) throw new Error("YOUTUBE_API_KEY 환경 변수가 필요합니다.");

async function youtube(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  Object.entries({ ...params, key: apiKey }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || `YouTube API 요청 실패: ${response.status}`);
  return body;
}

function loadExisting(source) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: "data/videos.js" });
  return Array.isArray(sandbox.window.VIDEOS) ? sandbox.window.VIDEOS : [];
}

function inferTheme(text) {
  if (/shorts?|쇼츠/i.test(text)) return "Shorts";
  if (/아침/.test(text)) return "아침기도";
  if (/저녁|밤|잠|수면/.test(text)) return "저녁기도";
  if (/큐티|묵상|말씀/.test(text)) return "말씀묵상";
  if (/위로|회복/.test(text)) return "위로묵상";
  return "기도";
}

function inferTags(text, theme) {
  const candidates = ["불안", "평안", "감사", "자녀", "가정", "건강", "회복", "위로", "수면", "지혜", "선택", "관계", "용서", "기도", "말씀"];
  const tags = candidates.filter((tag) => text.includes(tag)).slice(0, 4);
  if (!tags.includes(theme)) tags.unshift(theme);
  return [...new Set(tags)].slice(0, 5);
}

const existingSource = await readFile(outputPath, "utf8");
const existingByVideoId = new Map(loadExisting(existingSource).map((video) => [video.videoId, video]));
const channel = await youtube("channels", { part: "contentDetails", id: channelId });
const uploadsPlaylistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
if (!uploadsPlaylistId) throw new Error("채널 업로드 재생목록을 찾지 못했습니다.");

const playlist = await youtube("playlistItems", { part: "snippet,contentDetails", playlistId: uploadsPlaylistId, maxResults: 25 });
const records = (playlist.items || []).filter((item) => item.contentDetails?.videoId && item.snippet?.title !== "Private video").map((item) => {
  const videoId = item.contentDetails.videoId;
  const previous = existingByVideoId.get(videoId) || {};
  const title = item.snippet.title.trim();
  const apiDescription = item.snippet.description?.trim() || "";
  const text = `${title} ${apiDescription}`;
  return {
    id: previous.id || `youtube-${videoId}`,
    videoId,
    title,
    theme: previous.theme || inferTheme(text),
    scripture: previous.scripture || "",
    description: previous.description || apiDescription.split(/\r?\n/).find(Boolean)?.slice(0, 240) || "기도의샘물 유튜브에 게시된 말씀과 기도 영상입니다.",
    tags: previous.tags?.length ? previous.tags : inferTags(text, previous.theme || inferTheme(text)),
    publishedDate: item.contentDetails.videoPublishedAt?.slice(0, 10) || item.snippet.publishedAt?.slice(0, 10) || ""
  };
});

if (!records.length) throw new Error("공개 영상 데이터를 찾지 못해 기존 파일을 유지합니다.");

const output = `window.VIDEOS = ${JSON.stringify(records, null, 2)}.map((video) => ({
  ...video,
  url: video.url || \`https://www.youtube.com/watch?v=\${video.videoId}\`,
  thumbnail: video.thumbnail || \`https://i.ytimg.com/vi/\${video.videoId}/hqdefault.jpg\`
}));\n`;
await writeFile(outputPath, output, "utf8");
console.log(`YouTube 영상 ${records.length}개를 갱신했습니다.`);
