
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const INPUT = "./input";
const OUTPUT = "./output";
const RENDERED = "./rendered";
const WIDTH = 1080;
const HEIGHT = 1350;
const COUNT = 4;

function str(value, fallback) {
  if (value === null || value === undefined) return fallback || "";
  if (Array.isArray(value)) return value.map(v => str(v, "")).filter(Boolean).join(" · ");
  if (typeof value === "object") return fallback || "";
  return String(value).trim() || fallback || "";
}

function esc(value) {
  return str(value, "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function getSlide(data, index) {
  const slides = data.instagram.slides || [];
  const slide = slides.find(item => Number(item.page) === index + 1) || slides[index] || {};
  const sections = data.blog && Array.isArray(data.blog.sections) ? data.blog.sections : [];
  const section = sections[index] || sections[0] || {};
  const legacy = data["page" + (index + 1)] || {};

  const titles = [
    str(data.blog && data.blog.title, str(data.seo && data.seo.blog_title, str(data.content && data.content.topic, legacy.title))),
    str(section.heading, str(legacy.news_title, legacy.title)),
    str(section.heading, str(data.content && data.content.topic, legacy.title)),
    str(data.blog && data.blog.summary, str(data.blog && data.blog.conclusion, legacy.title))
  ];

  const bodies = [
    str(data.blog && data.blog.introduction, str(data.blog && data.blog.summary, legacy.intro)),
    str(section.body, str(legacy.summary, legacy.what_happened)),
    str(section.body, str(data.blog && data.blog.conclusion, legacy.impact)),
    str(data.blog && data.blog.summary, str(data.blog && data.blog.conclusion, legacy.final_message))
  ];

  const defaultTitles = [
    "오늘의 핵심 이야기",
    "핵심 내용을 살펴봅니다",
    "놓치지 말아야 할 포인트",
    "오늘의 내용 정리"
  ];

  const defaultBodies = [
    "핵심 내용을 쉽고 정확하게 정리했습니다.",
    "배경과 주요 내용을 차근차근 살펴보겠습니다.",
    "실제 생활과 투자 판단에 어떤 의미가 있는지 확인해 보겠습니다.",
    "중요한 내용을 다시 정리하고 다음에 확인할 점을 짚어봅니다."
  ];

  return {
    title: str(slide.title, titles[index] || defaultTitles[index]),
    body: str(slide.body, bodies[index] || defaultBodies[index]),
    highlight: str(slide.highlight, "")
  };
}

function safeImageUrl(data) {
  const value = str(data.content && data.content.cover_image_url,
    str(data.blog && data.blog.cover_image_url, ""));

  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function makeHtml(data, index, theme) {
  const slide = getSlide(data, index);
  const date = str(data.research && data.research.reference_date,
    str(data.market_date, new Date().toISOString().slice(0, 10)));

  const page = String(index + 1).padStart(2, "0");
  const cover = index === 0;
  const summary = index === 3;
  const imageUrl = cover ? safeImageUrl(data) : "";

  const bg = theme.lifestyle
    ? "background:linear-gradient(145deg,#f6f2e9,#e8e0d3);--panel:#f8f5ef;--ink:#25231f;--muted:#69645b;--accent:#8a6847;--line:#c9bca9;--glow:rgba(100,78,52,.12);"
    : "background:radial-gradient(circle at 85% 8%,#302411 0,transparent 35%),#080a0d;--panel:#11151a;--ink:#f4f0e7;--muted:#b9b4aa;--accent:#d6b46e;--line:#66502b;--glow:rgba(174,130,54,.2);";

  const coverBg = imageUrl
    ? "background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.8)),url('" + esc(imageUrl) + "');background-size:cover;background-position:center;"
    : "background:var(--panel);";

  const paragraphs = slide.body.split(/\n+/).filter(Boolean);
  let body = "";

  for (const paragraph of paragraphs) {
    body += "<p>" + esc(paragraph) + "</p>";
  }

  if (!body) body = "<p>핵심 내용을 정리했습니다.</p>";

  let main = "";

  if (cover) {
    main = '<div class="cover" style="' + coverBg + '">' +
      '<div class="cover-label">' + esc(theme.tagline) + '</div>' +
      '<div class="cover-title">' + esc(slide.title) + '</div>' +
      '<div class="cover-sub">' + esc(slide.body.slice(0, 160)) + '</div></div>';

    if (slide.highlight) {
      main += '<div class="highlight">' + esc(slide.highlight) + '</div>';
    }
  } else {
    const labels = ["", "KEY INFORMATION", "WHY IT MATTERS", "TODAY'S SUMMARY"];

    main = '<h1>' + esc(slide.title) + '</h1><div class="panel">' +
      '<div class="panel-label">' + labels[index] + '</div>' +
      '<div class="body">' + body + '</div>';

    if (slide.highlight) {
      main += '<div class="highlight">' + esc(slide.highlight) + '</div>';
    }

    main += '</div>';

    if (summary) {
      const takeaway1 = str(data.blog && data.blog.summary, slide.title);
      const takeaway2 = str(data.blog && data.blog.conclusion, slide.body.slice(0, 100));

      main += '<div class="takeaways"><div><b>01</b>' + esc(takeaway1) +
        '</div><div><b>02</b>' + esc(takeaway2) + '</div></div>';
    }
  }

  return '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">' +
    '<style>*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1350px;overflow:hidden}' +
    'body{font-family:Arial,"Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:var(--ink)}' +
    '.page{width:1080px;height:1350px;padding:76px 78px 72px;position:relative;overflow:hidden;' + bg + '}' +
    '.page:before{content:"";position:absolute;width:600px;height:600px;border-radius:50%;background:var(--glow);filter:blur(90px);right:-280px;top:180px}' +
    '.top{display:flex;justify-content:space-between;align-items:center;position:relative;z-index:2}' +
    '.brand{font-size:22px;font-weight:800;letter-spacing:4px;color:var(--accent)}.date{font-size:19px;color:var(--muted)}' +
    '.rule{height:2px;background:var(--line);margin:28px 0 52px;position:relative;z-index:2}' +
    '.category{font-size:22px;font-weight:800;letter-spacing:4px;color:var(--accent);position:relative;z-index:2}' +
    'h1{font-size:65px;line-height:1.2;letter-spacing:-3px;margin:28px 0 24px;font-weight:900;word-break:keep-all;position:relative;z-index:2}' +
    '.cover{height:720px;margin:38px -18px 0;border-radius:22px;padding:52px 42px;display:flex;flex-direction:column;justify-content:flex-end;border:1px solid var(--line);position:relative;z-index:1}' +
    '.cover-label{font-size:21px;letter-spacing:4px;color:var(--accent);font-weight:800;margin-bottom:24px}' +
    '.cover-title{font-size:61px;line-height:1.23;font-weight:900;letter-spacing:-2px;word-break:keep-all;color:var(--ink)}' +
    '.cover-sub{font-size:25px;line-height:1.5;margin-top:24px;color:var(--muted);word-break:keep-all}' +
    '.panel{margin-top:42px;padding:38px 40px;border:1px solid var(--line);border-radius:18px;background:var(--panel);position:relative;z-index:2}' +
    '.panel-label{font-size:20px;font-weight:800;letter-spacing:3px;color:var(--accent);margin-bottom:25px}' +
    '.body{font-size:29px;line-height:1.7;color:var(--muted);word-break:keep-all}.body p{margin:0 0 24px}' +
    '.highlight{margin-top:34px;padding:25px 28px;border-left:5px solid var(--accent);background:var(--panel);font-size:27px;line-height:1.5;font-weight:800;word-break:keep-all;position:relative;z-index:2}' +
    '.takeaways{margin-top:28px;display:grid;gap:16px;position:relative;z-index:2}.takeaways div{padding:22px 25px;border:1px solid var(--line);border-radius:13px;background:var(--panel);font-size:24px;line-height:1.45;word-break:keep-all}.takeaways b{color:var(--accent);margin-right:12px}' +
    '.footer{position:absolute;left:78px;right:78px;bottom:42px;display:flex;justify-content:space-between;font-size:17px;letter-spacing:2px;color:var(--muted);z-index:3}.footer b{color:var(--accent)}' +
    (theme.lifestyle ? '.cover-title{color:#fff;text-shadow:0 2px 15px rgba(0,0,0,.35)}.cover-sub{color:#f2eee7;text-shadow:0 1px 8px rgba(0,0,0,.5)}' : '') +
    '</style></head><body><div class="page">' +
    '<div class="top"><div class="brand">' + esc(theme.brand) + '</div><div class="date">' + esc(date) + '</div></div>' +
    '<div class="rule"></div><div class="category">' + esc(theme.label) + ' · ' + page + ' / 04</div>' +
    main +
    '<div class="footer"><span>' + esc(theme.brand) + '</span><b>' + page + ' / 04</b></div>' +
    '</div></body></html>';
}

function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("data.json은 JSON 객체여야 합니다.");
  }

  if (!data.instagram || !Array.isArray(data.instagram.slides) || data.instagram.slides.length < COUNT) {
    throw new Error("instagram.slides에 최소 4개의 슬라이드가 필요합니다.");
  }
}

function cleanOldFiles() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.mkdirSync(RENDERED, { recursive: true });

  for (let i = 1; i <= COUNT; i++) {
    for (const ext of ["jpg", "jpeg", "png"]) {
      const file = path.join(OUTPUT, "page" + i + "." + ext);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    const html = path.join(RENDERED, "page" + i + ".html");
    if (fs.existsSync(html)) fs.unlinkSync(html);
  }
}

async function main() {
  console.log("ECONOMY & LIFE · Category-aware renderer");

  const dataPath = path.join(INPUT, "data.json");

  if (!fs.existsSync(dataPath)) {
    throw new Error("input/data.json 파일이 없습니다.");
  }

  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  validate(data);

  const key = str(data.content && data.content.category, "economy").toLowerCase();
  const lifestyle = ["lifestyle", "daily", "travel", "review", "hobby"].includes(key);

  const labels = {
    economy: "ECONOMY",
    finance: "MONEY & FINANCE",
    lifestyle: "LIFESTYLE",
    daily: "DAILY LIFE",
    travel: "TRAVEL",
    review: "REAL REVIEW",
    hobby: "HOBBY & LIFE"
  };

  const theme = {
    lifestyle,
    label: labels[key] || (lifestyle ? "LIFESTYLE" : "ECONOMY & FINANCE"),
    brand: str(data.brand && data.brand.name, "ECONOMY & LIFE"),
    tagline: str(data.brand && data.brand.tagline, "돈의 흐름을 읽고, 삶을 기록하다.")
  };

  console.log("카테고리:", key, "| 디자인:", lifestyle ? "Editorial" : "Black & Gold");

  cleanOldFiles();

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1
    });

    page.on("pageerror", error => console.error("브라우저 오류:", error.message));

    for (let i = 0; i < COUNT; i++) {
      const htmlPath = path.join(RENDERED, "page" + (i + 1) + ".html");
      const imagePath = path.join(OUTPUT, "page" + (i + 1) + ".jpg");

      fs.writeFileSync(htmlPath, makeHtml(data, i, theme), "utf8");

      console.log("렌더링 " + (i + 1) + "/4");

      await page.goto("file://" + path.resolve(htmlPath), {
        waitUntil: "load",
        timeout: 60000
      });

      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });

      await page.screenshot({
        path: imagePath,
        type: "jpeg",
        quality: 92,
        fullPage: false
      });

      const size = fs.statSync(imagePath).size;

      if (size < 10000) {
        throw new Error(imagePath + " 생성 결과가 비정상적으로 작습니다.");
      }

      console.log("완료:", imagePath, Math.round(size / 1024) + " KB");
    }

    console.log("새 실행에서 생성된 이미지 4장 확인 완료");

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error("렌더링 실패:", error);
  process.exit(1);
});
