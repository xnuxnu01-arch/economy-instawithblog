
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const API_KEY = process.env.DART_API_KEY;

const OUTPUT_DIR = "data";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "stock_universe.json");

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getTag(block, tag) {
  const match = block.match(
    new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)
  );

  return match ? decodeXml(match[1].trim()) : "";
}

async function main() {
  if (!API_KEY || API_KEY.length !== 40) {
    throw new Error("DART_API_KEY가 없거나 40자 형식이 아닙니다.");
  }

  console.log("1. DART 기업 고유번호 목록 요청");

  const url =
    "https://opendart.fss.or.kr/api/corpCode.xml" +
    `?crtfc_key=${encodeURIComponent(API_KEY)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`DART 요청 실패: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dart-corp-")
  );

  try {
    const zipPath = path.join(tempDir, "corpCode.zip");
    fs.writeFileSync(zipPath, buffer);

    console.log("2. 기업 목록 압축 해제");

    const xml = execFileSync(
      "unzip",
      ["-p", zipPath],
      {
        encoding: "utf8",
        maxBuffer: 100 * 1024 * 1024
      }
    );

    const blocks = xml.match(/<list>[\s\S]*?<\/list>/g) || [];

    const companies = blocks
      .map((block) => ({
        corp_code: getTag(block, "corp_code"),
        corp_name: getTag(block, "corp_name"),
        stock_code: getTag(block, "stock_code"),
        modify_date: getTag(block, "modify_date")
      }))
      .filter((company) =>
        company.corp_code &&
        company.stock_code &&
        /^\d{6}$/.test(company.stock_code)
      )
      .sort((a, b) =>
        a.stock_code.localeCompare(b.stock_code)
      );

    if (companies.length === 0) {
      throw new Error("상장기업 목록을 찾지 못했습니다.");
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const result = {
      updated_at: new Date().toISOString(),
      source: "OpenDART",
      source_url: "https://opendart.fss.or.kr/",
      total_count: companies.length,
      companies
    };

    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(result, null, 2),
      "utf8"
    );

    console.log(`3. 상장기업 ${companies.length}개 수집 완료`);
    console.log(`저장 위치: ${OUTPUT_FILE}`);
  } finally {
    fs.rmSync(tempDir, {
      recursive: true,
      force: true
    });
  }
}

main().catch((error) => {
  console.error("기업 목록 수집 실패:", error.message);
  process.exit(1);
});
