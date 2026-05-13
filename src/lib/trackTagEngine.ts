import prisma from "./prisma";
import { getLastFmTrackTags } from "./providers/lastfm";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const runTrackTagEngine = async () => {
  console.log("[TrackTagEngine] Starting background track tag sync...");

  try {
    const tracksToProcess = await prisma.track.findMany({
      where: { tagsSyncedAt: null },
      include: { artist: true },
      take: 2000, 
    });

    console.log(`[TrackTagEngine] Found ${tracksToProcess.length} tracks needing tags.`);

    for (const track of tracksToProcess) {
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
        }

        // Mark track as synced
        await prisma.track.update({
          where: { id: track.id },
          data: { tagsSyncedAt: new Date() }
        });

      } catch (e: any) {
        console.error(`[TrackTagEngine] Unexpected error on track ${track.title}:`, e.message);
      }

      // Respect Last.fm API rate limits (5/sec allowed, we'll do 4/sec)
      await sleep(250);
    }

    console.log("[TrackTagEngine] Track tag sync batch completed!");

  } catch (error) {
    console.error("[TrackTagEngine] Sync failed", error);
  }
};
