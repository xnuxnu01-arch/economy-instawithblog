
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const INPUT = "./input";
const OUTPUT = "./output";
const RENDERED = "./rendered";

const WIDTH = 1080;
const HEIGHT = 1350;
const COUNT = 4;

function str(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(value)) {
    return value.map(v => str(v)).filter(Boolean).join(" · ");
  }
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function esc(value) {
  return str(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSlide(data, index) {
  const slides = data.instagram.slides || [];

  const slide =
    slides.find(item => Number(item.page) === index + 1) ||
    slides[index] ||
    {};

  const sections =
    data.blog && Array.isArray(data.blog.sections)
      ? data.blog.sections
      : [];

  const section = sections[index] || sections[0] || {};
  const legacy = data["page" + (index + 1)] || {};

  const titles = [
    str(
      data.blog && data.blog.title,
      str(
        data.seo && data.seo.blog_title,
        str(data.content && data.content.topic, legacy.title)
      )
    ),
    str(section.heading, str(legacy.news_title, legacy.title)),
    str(section.heading, str(data.content && data.content.topic, legacy.title)),
    str(
      data.blog && data.blog.summary,
      str(data.blog && data.blog.conclusion, legacy.title)
    )
  ];

  const bodies = [
    str(
      data.blog && data.blog.introduction,
      str(data.blog && data.blog.summary, legacy.intro)
    ),
    str(section.body, str(legacy.summary, legacy.what_happened)),
    str(
      section.body,
      str(data.blog && data.blog.conclusion, legacy.impact)
    ),
    str(
      data.blog && data.blog.summary,
      str(data.blog && data.blog.conclusion, legacy.final_message)
    )
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
  const value = str(
    data.content && data.content.cover_image_url,
    str(data.blog && data.blog.cover_image_url, "")
  );

  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function makeHtml(data, index, theme) {
  const slide = getSlide(data, index);

  const date = str(
    data.research && data.research.reference_date,
    str(data.market_date, new Date().toISOString().slice(0, 10))
  );

  const page = String(index + 1).padStart(2, "0");
  const cover = index === 0;
  const summary = index === 3;
  const imageUrl = cover ? safeImageUrl(data) : "";

  const coverBackground = imageUrl
    ? `
      background-image:
        linear-gradient(
          180deg,
          rgba(15,35,52,.12),
          rgba(15,35,52,.82)
        ),
        url('${esc(imageUrl)}');
      background-size: cover;
      background-position: center;
    `
    : `
      background:
        radial-gradient(
          circle at 90% 10%,
          #E2F0F0 0,
          transparent 38%
        ),
        #FFFFFF;
    `;

  const paragraphs = slide.body
    .split(/\n+/)
    .filter(Boolean);

  let body = "";

  for (const paragraph of paragraphs) {
    body += `<p>${esc(paragraph)}</p>`;
  }

  if (!body) {
    body = "<p>핵심 내용을 정리했습니다.</p>";
  }

  let main = "";

  if (cover) {
    main = `
      <div class="cover" style="${coverBackground}">
        <div class="cover-label">
          ${esc(theme.tagline)}
        </div>

        <div class="cover-title">
          ${esc(slide.title)}
        </div>

        <div class="cover-sub">
          ${esc(slide.body.slice(0, 160))}
        </div>
      </div>
    `;

    if (slide.highlight) {
      main += `
        <div class="highlight">
          ${esc(slide.highlight)}
        </div>
      `;
    }

  } else {
    const labels = [
      "",
      "KEY INFORMATION",
      "INVESTMENT INSIGHT",
      "TODAY'S SUMMARY"
    ];

    main = `
      <h1>${esc(slide.title)}</h1>

      <div class="panel">

        <div class="panel-label">
          ${labels[index]}
        </div>

        <div class="body">
          ${body}
        </div>
    `;

    if (slide.highlight) {
      main += `
        <div class="highlight">
          ${esc(slide.highlight)}
        </div>
      `;
    }

    main += "</div>";

    if (summary) {
      const takeaway1 = str(
        data.blog && data.blog.summary,
        slide.title
      );

      const takeaway2 = str(
        data.blog && data.blog.conclusion,
        slide.body.slice(0, 100)
      );

      main += `
        <div class="takeaways">

          <div>
            <b>01</b>
            ${esc(takeaway1)}
          </div>

          <div>
            <b>02</b>
            ${esc(takeaway2)}
          </div>

        </div>
      `;
    }
  }

  return `
<!DOCTYPE html>
<html lang="ko">

<head>
<meta charset="UTF-8">

<style>

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  width: ${WIDTH}px;
  height: ${HEIGHT}px;
  overflow: hidden;
}

body {
  font-family:
    "Noto Sans KR",
    "Malgun Gothic",
    "Apple SD Gothic Neo",
    sans-serif;

  color: #172D42;
}

.page {
  width: ${WIDTH}px;
  height: ${HEIGHT}px;

  padding: 76px 78px 72px;

  position: relative;
  overflow: hidden;

  background:
    radial-gradient(
      circle at 90% 8%,
      #E8F2F3 0,
      transparent 35%
    ),
    #F7F9F8;

  color: #172D42;
}

.page:before {
  content: "";

  position: absolute;

  width: 520px;
  height: 520px;

  border-radius: 50%;

  background: rgba(65,151,157,.08);

  filter: blur(80px);

  right: -250px;
  top: 400px;
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: center;

  position: relative;
  z-index: 2;
}

.brand {
  font-size: 25px;
  font-weight: 900;
  letter-spacing: 3px;

  color: #234B63;
}

.date {
  font-size: 19px;
  color: #82919A;
}

.rule {
  height: 2px;

  background: #DCE7E8;

  margin: 28px 0 52px;

  position: relative;
  z-index: 2;
}

.category {
  display: inline-block;

  font-size: 21px;
  font-weight: 900;
  letter-spacing: 3px;

  color: #247B83;

  position: relative;
  z-index: 2;
}

h1 {
  font-size: 68px;
  line-height: 1.24;

  letter-spacing: -3px;

  margin: 34px 0 32px;

  font-weight: 900;

  color: #172D42;

  word-break: keep-all;

  position: relative;
  z-index: 2;
}

.cover {
  height: 760px;

  margin: 38px -18px 0;

  border-radius: 28px;

  padding: 58px 48px;

  display: flex;
  flex-direction: column;
  justify-content: flex-end;

  border: 1px solid #DDE7E7;

  position: relative;
  z-index: 1;
}

.cover-label {
  font-size: 23px;

  letter-spacing: 3px;

  color: #247B83;

  font-weight: 900;

  margin-bottom: 28px;
}

.cover-title {
  font-size: 76px;

  line-height: 1.22;

  font-weight: 900;

  letter-spacing: -3px;

  word-break: keep-all;

  color: #172D42;
}

.cover-sub {
  font-size: 28px;

  line-height: 1.65;

  margin-top: 28px;

  color: #536879;

  word-break: keep-all;
}

.panel {
  margin-top: 42px;

  padding: 42px;

  border: 1px solid #E0E9E9;

  border-radius: 24px;

  background: rgba(255,255,255,.94);

  box-shadow:
    0 12px 35px rgba(33,65,77,.05);

  position: relative;
  z-index: 2;
}

.panel-label {
  font-size: 20px;

  font-weight: 900;

  letter-spacing: 3px;

  color: #27818A;

  margin-bottom: 30px;
}

.body {
  font-size: 32px;

  line-height: 1.75;

  color: #465D6C;

  word-break: keep-all;
}

.body p {
  margin: 0 0 25px;
}

.highlight {
  margin-top: 36px;

  padding: 30px 32px;

  border-left: 8px solid #25838A;

  border-radius: 0 16px 16px 0;

  background: #E8F3F2;

  font-size: 31px;

  line-height: 1.5;

  font-weight: 900;

  color: #1D6570;

  word-break: keep-all;

  position: relative;
  z-index: 2;
}

.takeaways {
  margin-top: 30px;

  display: grid;

  gap: 18px;

  position: relative;
  z-index: 2;
}

.takeaways div {
  padding: 25px 28px;

  border: 1px solid #DFE9E9;

  border-radius: 17px;

  background: #FFFFFF;

  font-size: 25px;

  line-height: 1.5;

  color: #465D6C;

  word-break: keep-all;
}

.takeaways b {
  color: #25838A;

  font-size: 27px;

  margin-right: 14px;
}

.footer {
  position: absolute;

  left: 78px;
  right: 78px;

  bottom: 42px;

  display: flex;
  justify-content: space-between;

  font-size: 17px;

  letter-spacing: 2px;

  color: #82919A;

  z-index: 3;
}

.footer b {
  color: #247B83;
}

${imageUrl ? `
.cover-title {
  color: #FFFFFF;
  text-shadow: 0 3px 20px rgba(0,0,0,.4);
}

.cover-sub {
  color: #FFFFFF;
  text-shadow: 0 2px 12px rgba(0,0,0,.4);
}

.cover-label {
  color: #FFFFFF;
}
` : ""}

</style>
</head>

<body>

<div class="page">

  <div class="top">

    <div class="brand">
      ${esc(theme.brand)}
    </div>

    <div class="date">
      ${esc(date)}
    </div>

  </div>

  <div class="rule"></div>

  <div class="category">
    ${esc(theme.label)} · ${page} / 04
  </div>

  ${main}

  <div class="footer">

    <span>
      ${esc(theme.brand)}
    </span>

    <b>
      ${page} / 04
    </b>

  </div>

</div>

</body>
</html>
`;
}

function validate(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error("data.json은 JSON 객체여야 합니다.");
  }

  if (
    !data.instagram ||
    !Array.isArray(data.instagram.slides) ||
    data.instagram.slides.length < COUNT
  ) {
    throw new Error(
      "instagram.slides에 최소 4개의 슬라이드가 필요합니다."
    );
  }
}

function cleanOldFiles() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.mkdirSync(RENDERED, { recursive: true });

  for (let i = 1; i <= COUNT; i++) {

    for (const ext of ["jpg", "jpeg", "png"]) {

      const file = path.join(
        OUTPUT,
        "page" + i + "." + ext
      );

      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    const html = path.join(
      RENDERED,
      "page" + i + ".html"
    );

    if (fs.existsSync(html)) {
      fs.unlinkSync(html);
    }
  }
}

async function main() {
  console.log(
    "ECONOMY & LIFE · Bright Editorial Renderer"
  );

  const dataPath = path.join(
    INPUT,
    "data.json"
  );

  if (!fs.existsSync(dataPath)) {
    throw new Error(
      "input/data.json 파일이 없습니다."
    );
  }

  const data = JSON.parse(
    fs.readFileSync(dataPath, "utf8")
  );

  validate(data);

  const key = str(
    data.content && data.content.category,
    "economy"
  ).toLowerCase();

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
    label:
      labels[key] || "ECONOMY & FINANCE",

    brand: str(
      data.brand && data.brand.name,
      "ECONOMY & LIFE"
    ),

    tagline: str(
      data.brand && data.brand.tagline,
      "돈의 흐름을 읽고, 삶을 기록하다."
    )
  };

  console.log(
    "카테고리:",
    key,
    "| 디자인: Bright Editorial"
  );

  cleanOldFiles();

  const browser = await chromium.launch({
    headless: true
  });

  try {

    const page = await browser.newPage({
      viewport: {
        width: WIDTH,
        height: HEIGHT
      },

      deviceScaleFactor: 1
    });

    page.on(
      "pageerror",
      error => {
        console.error(
          "브라우저 오류:",
          error.message
        );
      }
    );

    for (let i = 0; i < COUNT; i++) {

      const htmlPath = path.join(
        RENDERED,
        "page" + (i + 1) + ".html"
      );

      const imagePath = path.join(
        OUTPUT,
        "page" + (i + 1) + ".jpg"
      );

      fs.writeFileSync(
        htmlPath,
        makeHtml(data, i, theme),
        "utf8"
      );

      console.log(
        "렌더링 " + (i + 1) + "/4"
      );

      await page.goto(
        "file://" + path.resolve(htmlPath),
        {
          waitUntil: "load",
          timeout: 60000
        }
      );

      await page.evaluate(async () => {
        if (
          document.fonts &&
          document.fonts.ready
        ) {
          await document.fonts.ready;
        }
      });

      await page.screenshot({
        path: imagePath,
        type: "jpeg",
        quality: 92,
        fullPage: false
      });

      const size = fs.statSync(
        imagePath
      ).size;

      if (size < 10000) {
        throw new Error(
          imagePath +
          " 생성 결과가 비정상적으로 작습니다."
        );
      }

      console.log(
        "완료:",
        imagePath,
        Math.round(size / 1024) + " KB"
      );
    }

    console.log(
      "새 실행에서 생성된 이미지 4장 확인 완료"
    );

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(
    "렌더링 실패:",
    error
  );

  process.exit(1);
});
