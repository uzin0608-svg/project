// 빌드 결과(.next/static)와 소스(src)에 API 키 값이 들어 있지 않은지 확인합니다.
// 키 값은 출력하지 않고, 찾았는지 여부와 파일 경로만 알립니다.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const envFile = path.join(root, ".env.local");

function readKey() {
  if (!existsSync(envFile)) return "";
  const line = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("GEMINI_API_KEY="));
  return line ? line.slice("GEMINI_API_KEY=".length).trim().replace(/^["']|["']$/g, "") : "";
}

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const key = readKey();
if (key.length < 8) {
  console.log("확인 건너뜀: .env.local에 키가 없거나 너무 짧아 비교할 수 없습니다.");
  process.exit(0);
}

const targets = [path.join(root, ".next", "static"), path.join(root, "src"), path.join(root, "docs"), path.join(root, ".env.example")];
const hits = [];
let scanned = 0;
for (const target of targets) {
  const files = existsSync(target) && statSync(target).isFile() ? [target] : [...walk(target)];
  for (const file of files) {
    scanned += 1;
    if (readFileSync(file, "utf8").includes(key)) hits.push(path.relative(root, file));
  }
}

if (hits.length > 0) {
  console.error(`키 값이 다음 파일에 들어 있습니다(값은 출력하지 않음): ${hits.join(", ")}`);
  process.exit(1);
}
console.log(`키 노출 검사 통과: ${scanned}개 파일에서 키 값을 찾지 못했습니다.`);
