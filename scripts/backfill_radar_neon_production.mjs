import { pathToFileURL } from "node:url";

import { runRadarNeonBackfill } from "./backfill_radar_neon_homolog.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRadarNeonBackfill("production").catch((error) => {
    process.stderr.write((error instanceof Error ? error.message : "Falha no backfill Neon do Radar.") + "\n");
    process.exitCode = 1;
  });
}
