import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(directory, "../data/dailyContents.js");
const categories = {
  word: { label: "말씀 붙들기", imageTheme: "open-bible", icon: "bible", detailUrl: "prayers.html" },
  evening: { label: "저녁기도", imageTheme: "night-window", icon: "moon", detailUrl: "night-prayer.html" },
  morning: { label: "아침기도", imageTheme: "morning-light", icon: "sun", detailUrl: "morning-prayer.html" },
  editorial: { label: "큐티(QT)", imageTheme: "editorial-paper", icon: "book", detailUrl: "meditation.html" }
};
const categoryKeys = Object.keys(categories);
const textFields = ["title", "scriptureRef", "scriptureText", "summary", "body", "prayer", "confession", "editorialQuestion", "editorialInsight", "application"];
const requiredFields = ["title", "scriptureRef", "scriptureText", "summary", "body", "prayer", "application"];
const forbidden = ["반드시 응답받는 기도", "기도만 하면 치유됩니다", "즉시 해결", "구매하면 문제가 해결됩니다"];

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function loadContents(source) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: dataPath, timeout: 1000 });
  if (!Array.isArray(sandbox.window.DAILY_CONTENTS)) throw new Error("DAILY_CONTENTS must be an array.");
  return sandbox.window.DAILY_CONTENTS;
}

function responseSchema() {
  const properties = {
    category: { type: "string", enum: categoryKeys },
    title: { type: "string" }, scriptureRef: { type: "string" }, scriptureText: { type: "string" },
    summary: { type: "string" }, body: { type: "string" }, prayer: { type: "string" },
    confession: { type: "string" }, editorialQuestion: { type: "string" },
    editorialInsight: { type: "string" }, application: { type: "string" },
    tags: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } }
  };
  return {
    type: "object", additionalProperties: false, required: ["contents"],
    properties: {
      contents: {
        type: "array", minItems: 4, maxItems: 4,
        items: { type: "object", additionalProperties: false, required: Object.keys(properties), properties }
      }
    }
  };
}

function prompt(date) {
  return [
    "당신은 기도의샘물의 한국어 기독교 일일 콘텐츠 편집자입니다.",
    "Asia/Seoul 기준 " + date + "에 게시할 콘텐츠를 JSON으로 작성하세요.",
    "word(말씀 붙들기), evening(저녁기도), morning(아침기도), editorial(큐티 QT)를 각각 하나씩, 총 네 개만 작성하세요.",
    "문장은 차분하고 따뜻하게 쓰며 치유, 문제 해결, 응답을 보장하지 마세요.",
    "성경 본문은 짧은 구절과 출처 중심으로 쓰고 긴 인용은 피하세요.",
    "반드시 응답받는 기도, 기도만 하면 치유됩니다, 즉시 해결, 구매하면 문제가 해결됩니다라는 표현을 쓰지 마세요.",
    "모든 항목은 title, scriptureRef, scriptureText, summary, body, prayer, application과 2~5개의 짧은 tags를 채우세요.",
    "word, evening, morning은 confession을 채우고 editorialQuestion과 editorialInsight는 빈 문자열로 두세요.",
    "editorial은 editorialQuestion과 editorialInsight를 채우고 confession은 빈 문자열로 두세요.",
    "word는 오늘 붙들 한 구절과 짧은 기도, evening은 하루 정리와 평안, morning은 감사와 오늘 실천, editorial은 성경 이야기와 오늘 삶을 연결하는 사설형 묵상에 집중하세요."
  ].join("\n");
}

function outputText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text;
  const text = (response.output || []).flatMap(function (item) { return item.content || []; })
    .filter(function (part) { return part.type === "output_text" && typeof part.text === "string"; })
    .map(function (part) { return part.text; }).join("");
  if (!text.trim()) throw new Error("OpenAI response did not include structured output.");
  return text;
}

async function generate(date) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!key) throw new Error("OPENAI_API_KEY is required.");
  if (!model) throw new Error("OPENAI_MODEL is required.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: prompt(date),
      text: { format: { type: "json_schema", name: "daily_content_batch", strict: true, schema: responseSchema() } }
    })
  });
  if (!response.ok) throw new Error("OpenAI request failed with status " + response.status + ".");
  return JSON.parse(outputText(await response.json())).contents;
}

function validate(items) {
  if (!Array.isArray(items) || items.length !== categoryKeys.length) throw new Error("Generation must return exactly four items.");
  const seen = new Set();
  for (const item of items) {
    if (!item || !categoryKeys.includes(item.category) || seen.has(item.category)) throw new Error("Each category must appear exactly once.");
    seen.add(item.category);
    for (const field of textFields) {
      if (typeof item[field] !== "string") throw new Error(item.category + "." + field + " must be a string.");
      if (item[field].length > 1600) throw new Error(item.category + "." + field + " is too long.");
      if (forbidden.some(function (phrase) { return item[field].includes(phrase); })) throw new Error(item.category + "." + field + " includes prohibited language.");
    }
    for (const field of requiredFields) {
      if (!item[field].trim()) throw new Error(item.category + "." + field + " must not be empty.");
    }
    if (!Array.isArray(item.tags) || item.tags.length < 2 || item.tags.length > 5 || item.tags.some(function (tag) { return typeof tag !== "string" || !tag.trim(); })) {
      throw new Error(item.category + ".tags must contain 2 to 5 non-empty strings.");
    }
    if (new Set(item.tags).size !== item.tags.length) throw new Error(item.category + ".tags must not contain duplicates.");
    if (item.category === "editorial" && (!item.editorialQuestion.trim() || !item.editorialInsight.trim() || item.confession.trim())) {
      throw new Error("editorial requires editorial fields and an empty confession.");
    }
    if (item.category !== "editorial" && (!item.confession.trim() || item.editorialQuestion.trim() || item.editorialInsight.trim())) {
      throw new Error(item.category + " requires a confession and empty editorial fields.");
    }
  }
}

function complete(item, date) {
  const metadata = categories[item.category];
  return {
    id: item.category + "-" + date, date, category: item.category, categoryLabel: metadata.label,
    title: item.title.trim(), scriptureRef: item.scriptureRef.trim(), scriptureText: item.scriptureText.trim(),
    summary: item.summary.trim(), body: item.body.trim(), prayer: item.prayer.trim(), confession: item.confession.trim(),
    editorialQuestion: item.editorialQuestion.trim(), editorialInsight: item.editorialInsight.trim(),
    application: item.application.trim(), tags: item.tags.map(function (tag) { return tag.trim(); }),
    imageTheme: metadata.imageTheme, icon: metadata.icon, detailUrl: metadata.detailUrl
  };
}

function insert(source, entries) {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const marker = "window.DAILY_CONTENTS = [" + newline;
  if (!source.includes(marker)) throw new Error("Could not find DAILY_CONTENTS array declaration.");
  const serialized = entries.map(function (entry) {
    return JSON.stringify(entry, null, 2).split("\n").map(function (line) { return "  " + line; }).join(newline);
  }).join("," + newline);
  return source.replace(marker, marker + serialized + "," + newline);
}

async function main() {
  const date = todayInSeoul();
  const source = fs.readFileSync(dataPath, "utf8");
  const existing = loadContents(source);
  const existingCategories = new Set(existing.filter(function (item) {
    return item.date === date && categoryKeys.includes(item.category);
  }).map(function (item) { return item.category; }));
  if (existingCategories.size === categoryKeys.length) {
    console.log("All daily categories already exist for " + date + "; no update needed.");
    return;
  }
  const generated = await generate(date);
  validate(generated);
  const additions = generated.filter(function (item) { return !existingCategories.has(item.category); })
    .map(function (item) { return complete(item, date); });
  const updated = insert(source, additions);
  loadContents(updated);
  fs.writeFileSync(dataPath, updated, "utf8");
  console.log("Added " + additions.length + " daily content item(s) for " + date + ".");
}

main().catch(function (error) {
  console.error("Daily content generation failed: " + error.message);
  process.exitCode = 1;
});
