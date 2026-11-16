
import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.KRX_API_KEY;

const OUTPUT_DIR = "data";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "market_data.json");

const MARKETS = [
  {
    name: "KOSPI",
    apiId: "stk_bydd_trd"
  },
  {
    name: "KOSDAQ",
    apiId: "ksq_bydd_trd"
  },
  {
    name: "KONEX",
    apiId: "knx_bydd_trd"
  }
];

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}${m}${d}`;
}

function extractRows(json) {
  if (Array.isArray(json)) return json;

  const possibleKeys = [
    "OutBlock_1",
    "output",
    "data",
    "result"
  ];

  for (const key of possibleKeys) {
    if (Array.isArray(json?.[key])) {
      return json[key];
    }
  }

  return [];
}

async function fetchMarketData(apiId, date) {
  const url = new URL(
    `https://data-dbg.krx.co.kr/svc/apis/sto/${apiId}`
  );

  url.searchParams.set("basDd", date);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      AUTH_KEY: API_KEY,
      Accept: "application/json"
    }
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `${apiId}: HTTP ${response.status} - ${body.slice(0, 300)}`
    );
  }

  let json;

  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(
      `${apiId}: JSON 응답이 아닙니다. ${body.slice(0, 300)}`
    );
  }

  const rows = extractRows(json);

  if (rows.length === 0 && !json?.OutBlock_1) {
    throw new Error(
      `${apiId}: 데이터 형식을 확인해야 합니다. ${JSON.stringify(json).slice(0, 500)}`
    );
  }

  return rows;
}

async function main() {
  if (!API_KEY) {
    throw new Error("KRX_API_KEY가 설정되지 않았습니다.");
  }

  console.log("KRX 시장 데이터 수집 시작");

  const today = new Date();
  let marketDate = null;
  let kospiRows = [];

  // 주말 및 공휴일을 고려해 최근 10일을 확인
  for (let i = 1; i <= 10; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const candidate = formatDate(date);

    console.log(`기준일 확인: ${candidate}`);

    try {
      const rows = await fetchMarketData(
        "stk_bydd_trd",
        candidate
      );

      if (rows.length > 0) {
        marketDate = candidate;
        kospiRows = rows;
        break;
      }
    } catch (error) {
      console.log(`날짜 확인 실패: ${error.message}`);
    }
  }

  if (!marketDate) {
    throw new Error("최근 10일 내 유가증권 데이터를 찾지 못했습니다.");
  }

  console.log(`최종 기준일: ${marketDate}`);

  const result = {
    updated_at: new Date().toISOString(),
    reference_date: marketDate,
    source: "KRX OPEN API",
    markets: {}
  };

  for (const market of MARKETS) {
    console.log(`${market.name} 데이터 수집 중`);

    const rows =
      market.name === "KOSPI"
        ? kospiRows
        : await fetchMarketData(market.apiId, marketDate);

    result.markets[market.name] = {
      api_id: market.apiId,
      count: rows.length,
      stocks: rows
    };

    console.log(`${market.name}: ${rows.length}개 종목`);
  }

  const totalCount = Object.values(result.markets)
    .reduce((sum, market) => sum + market.count, 0);

  if (totalCount === 0) {
    throw new Error("수집된 종목 데이터가 없습니다.");
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(result, null, 2),
    "utf8"
  );

  console.log("--------------------------------");
  console.log(`총 수집 종목: ${totalCount}개`);
  console.log(`저장 파일: ${OUTPUT_FILE}`);
  console.log("KRX 데이터 수집 완료");
}

main().catch((error) => {
  console.error("KRX 수집 실패:", error.message);
  process.exit(1);
});
