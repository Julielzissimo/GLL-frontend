import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TARGETS = {
  homolog: {
    outputDir: "homolog",
    environment: "homolog",
    label: "Homologação",
    description: "Ambiente web de homologação",
    storageLabel: "Supabase homologação",
    storageSuffix: "homolog",
    supabaseUrl: "https://dwotbzrjcetizyygzoty.supabase.co",
    supabaseAnonKey: "sb_publishable_Xud-GtYCKZdIsXkAaa43rA_pXPqGTPn",
  },
  production: {
    outputDir: "prod",
    environment: "production",
    label: "Produção",
    description: "Ambiente web de produção",
    storageLabel: "Supabase produção",
    storageSuffix: "production",
    supabaseUrl: "https://siqsjxohpcrujobkbshn.supabase.co",
    supabaseAnonKey: "sb_publishable_MiojjcG8vXoQxn3NBcRgUQ_ymOMWAkW",
  },
  prod: null,
};

TARGETS.prod = TARGETS.production;

const targetName = process.argv[2];
const target = TARGETS[targetName];

if (!target) {
  console.error("Uso: node scripts/build-web.mjs <homolog|production>");
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const sourceDir = resolve(rootDir, "web");
const outputDir = resolve(rootDir, "dist", target.outputDir);

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(sourceDir, outputDir, { recursive: true });

const runtimeConfig = {
  environment: target.environment,
  label: target.label,
  description: target.description,
  storageLabel: target.storageLabel,
  storageSuffix: target.storageSuffix,
  appName: "GLL Web",
  supabaseUrl: process.env.GLL_SUPABASE_URL || target.supabaseUrl || "",
  supabaseAnonKey: process.env.GLL_SUPABASE_ANON_KEY || process.env.GLL_SUPABASE_PUBLISHABLE_KEY || target.supabaseAnonKey || "",
};

await writeFile(
  resolve(outputDir, "env.js"),
  `window.GLL_CONFIG = ${JSON.stringify(runtimeConfig, null, 2)};\n`,
  "utf8",
);

const assetVersion = createHash("sha256")
  .update(await readFile(resolve(sourceDir, "app.js")))
  .update(await readFile(resolve(sourceDir, "styles.css")))
  .digest("hex")
  .slice(0, 12);
const outputIndexPath = resolve(outputDir, "index.html");
const outputIndex = await readFile(outputIndexPath, "utf8");
await writeFile(
  outputIndexPath,
  outputIndex
    .replace('./styles.css', `./styles.css?v=${assetVersion}`)
    .replace('./app.js', `./app.js?v=${assetVersion}`),
  "utf8",
);

console.log(`GLL Web ${target.label} gerado em ${outputDir}`);
