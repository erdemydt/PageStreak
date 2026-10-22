// @ts-nocheck

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EN_PATH = path.join(ROOT, "i18n", "en.json");
const TR_PATH = path.join(ROOT, "i18n", "tr.json");

const readJson = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
};

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const collectKinds = (value, basePath = "", kinds = new Map()) => {
  if (isObject(value)) {
    if (basePath) {
      kinds.set(basePath, "object");
    }

    for (const [key, child] of Object.entries(value)) {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      collectKinds(child, nextPath, kinds);
    }

    return kinds;
  }

  if (basePath) {
    kinds.set(basePath, "value");
  }

  return kinds;
};

const printList = (title, items) => {
  if (items.length === 0) {
    return;
  }

  console.error(`\n${title} (${items.length})`);
  for (const item of items) {
    console.error(`- ${item}`);
  }
};

const main = () => {
  const en = readJson(EN_PATH);
  const tr = readJson(TR_PATH);

  const enKinds = collectKinds(en);
  const trKinds = collectKinds(tr);

  const missingInTr = [];
  const missingInEn = [];
  const typeMismatches = [];

  for (const [key, kind] of enKinds.entries()) {
    if (!trKinds.has(key)) {
      missingInTr.push(key);
      continue;
    }

    if (trKinds.get(key) !== kind) {
      typeMismatches.push(`${key} (en:${kind} vs tr:${trKinds.get(key)})`);
    }
  }

  for (const key of trKinds.keys()) {
    if (!enKinds.has(key)) {
      missingInEn.push(key);
    }
  }

  if (
    missingInTr.length === 0 &&
    missingInEn.length === 0 &&
    typeMismatches.length === 0
  ) {
    console.log("i18n parity check passed: EN/TR key structure is aligned.");
    process.exit(0);
  }

  printList("Missing keys in TR", missingInTr);
  printList("Missing keys in EN", missingInEn);
  printList("Type mismatches", typeMismatches);

  process.exit(1);
};

main();
