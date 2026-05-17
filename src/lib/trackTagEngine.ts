import prisma from "./prisma";
import { getLastFmTrackTags } from "./providers/lastfm";
import { resolveDelayMs, resolveLimit, type SyncEngineOptions } from "./syncSettings";
import {
  engineBatchSize,
  trackAttemptsTotal,
  trackDurationSeconds,
} from "./metrics";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ENGINE = "tags";

export const runTrackTagEngine = async (options: SyncEngineOptions = {}) => {
  console.log("[TrackTagEngine] Starting background track tag sync...");

  try {
    const batchSize = resolveLimit(options.tagBatchSize, "TRACK_TAG_BATCH_SIZE");
    const providerDelayMs = resolveDelayMs(options.providerDelayMs, 250);
    const tracksToProcess = await prisma.track.findMany({
      where: { tagsSyncedAt: null },
      include: { artist: true },
      ...(batchSize ? { take: batchSize } : {}),
    });

    console.log(`[TrackTagEngine] Found ${tracksToProcess.length} tracks needing tags.`);
    engineBatchSize.observe({ engine: ENGINE }, tracksToProcess.length);

    for (const track of tracksToProcess) {
      let outcome: "success" | "not_found" | "rate_limited" | "error" = "success";
      const endTimer = trackDurationSeconds.startTimer({ engine: ENGINE });
      try {
        const tags = await getLastFmTrackTags(track.artist.title, track.title);

        if (tags.length > 0) {
          // Connect or create each tag and link to the track
          for (const tagName of tags) {
            const cleanTag = tagName.toLowerCase().trim();
            if (cleanTag.length < 2) continue;

            const tagRecord = await prisma.tag.upsert({
              where: { type_name: { type: "genre", name: cleanTag } },
              update: {},
              create: { type: "genre", name: cleanTag },
            });

            // Link to track
            await prisma.track.update({
              where: { id: track.id },
              data: {
                tags: {
                  connect: { id: tagRecord.id }
                }
              }
            });
          }
          console.log(`[TrackTagEngine] Track "${track.title}" -> Tags: ${tags.join(", ")}`);
        } else {
          // No tags found, but we still mark it as synced so we don't retry it constantly
          outcome = "not_found";
        }

        // Mark track as synced
        await prisma.track.update({
          where: { id: track.id },
          data: { tagsSyncedAt: new Date() }
        });

      } catch (e: any) {
        console.error(`[TrackTagEngine] Unexpected error on track ${track.title}:`, e.message);
        outcome = "error";
      } finally {
        endTimer();
        trackAttemptsTotal.inc({ engine: ENGINE, result: outcome });
      }

      if (providerDelayMs > 0) {
        await sleep(providerDelayMs);
      }
    }

    console.log("[TrackTagEngine] Track tag sync batch completed!");

  } catch (error) {
    console.error("[TrackTagEngine] Sync failed", error);
  }
};
