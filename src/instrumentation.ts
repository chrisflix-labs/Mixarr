export async function register() {
  // Only run in the Node.js runtime (not Edge / browser builds).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Optional: start a dedicated /metrics HTTP server on its own port so
  // Prometheus can scrape Mixarr. METRICS_PORT=0 (the default) disables
  // it entirely and avoids opening a second listener.
  const metricsPort = Number(process.env.METRICS_PORT || "0");
  if (Number.isFinite(metricsPort) && metricsPort > 0) {
    const { startMetricsServer } = await import('./lib/metrics');
    startMetricsServer(metricsPort);
  } else {
    console.log("[Metrics] Prometheus endpoint disabled (METRICS_PORT is 0 or unset)");
  }

  const cron = await import('node-cron');

  // Read schedule from .env, default to 3:00 AM daily
  const schedule = process.env.SYNC_CRON_SCHEDULE || '0 3 * * *';

  console.log(`[Scheduler] Initializing autonomous background sync with schedule: ${schedule}`);

  cron.schedule(schedule, async () => {
    const { pipelineRunsTotal, pipelineDurationSeconds } = await import('./lib/metrics');
    const endTimer = pipelineDurationSeconds.startTimer();
    let pipelineResult: "success" | "failed" = "success";

    console.log("[Scheduler] Starting nightly autonomous sync pipeline...");

    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      // 1. Sync all libraries from Plex
      console.log("[Scheduler] Step 1/5: Pulling latest tracks from Plex...");
      const libraries = await prisma.library.findMany();
      if (libraries.length > 0) {
        const { runSyncEngine } = await import('./lib/syncEngine');
        for (const lib of libraries) {
          console.log(`[Scheduler] Syncing library: ${lib.name} (${lib.id})`);
          await runSyncEngine(lib.id);
        }
      } else {
        console.log("[Scheduler] No libraries found. Skipping Plex sync.");
      }

      // 2. Run Audio Feature Enrichment
      console.log("[Scheduler] Step 2/5: Enriching Audio Features...");
      const { runAudioFeatureEngine } = await import('./lib/audioFeatureEngine');
      await runAudioFeatureEngine();

      // 3. Run Popularity Enrichment
      console.log("[Scheduler] Step 3/5: Fetching Popularity Scores...");
      const { runPopularityEngine } = await import('./lib/popularityEngine');
      await runPopularityEngine();

      // 4. Run Track Genre Enrichment
      console.log("[Scheduler] Step 4/5: Fetching Track-Level Genres...");
      const { runTrackTagEngine } = await import('./lib/trackTagEngine');
      await runTrackTagEngine();

      // 5. Refresh saved Plex playlists that opted into auto-refresh
      console.log("[Scheduler] Step 5/5: Refreshing saved smart playlists...");
      const { refreshAutoPlaylists } = await import('./lib/playlistService');
      const refreshedCount = await refreshAutoPlaylists();
      console.log(`[Scheduler] Refreshed ${refreshedCount} saved smart playlists.`);

      console.log("[Scheduler] 🎉 Autonomous nightly sync pipeline completed successfully!");
    } catch (e) {
      console.error("[Scheduler] ❌ Nightly sync pipeline failed:", e);
      pipelineResult = "failed";
    } finally {
      endTimer();
      pipelineRunsTotal.inc({ result: pipelineResult });
    }
  });
}
