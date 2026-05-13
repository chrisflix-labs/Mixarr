import prisma from "./prisma";
import { getDeezerPopularity } from "./providers/deezer";
import { getLastFmPopularity } from "./providers/lastfm";
import { getSpotifyPopularity } from "./providers/spotify";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const runPopularityEngine = async () => {
  console.log("[PopularityEngine] Starting background popularity sync...");

  try {
    // Find tracks that have NO popularity record
    const tracksToProcess = await prisma.track.findMany({
      where: { popularity: null },
      include: { artist: true },
      // Limit to 5000 per run to avoid memory issues, it can be run multiple times
      take: 5000, 
    });

    console.log(`[PopularityEngine] Found ${tracksToProcess.length} tracks needing popularity data.`);

    for (const track of tracksToProcess) {
      let score: number | null = null;
      let provider = "none";

      try {
        // 1. Try Deezer (Primary)
        let dScore = await getDeezerPopularity(track.artist.title, track.title);
        if (dScore != null && !isNaN(dScore)) {
          score = dScore;
          provider = "deezer";
        } else {
          // 2. Fallback to Last.fm
          let lScore = await getLastFmPopularity(track.artist.title, track.title);
          if (lScore != null && !isNaN(lScore)) {
            score = lScore;
            provider = "lastfm";
          } else {
            // 3. Fallback to Spotify
            let sScore = await getSpotifyPopularity(track.artist.title, track.title);
            if (sScore != null && !isNaN(sScore)) {
              score = sScore;
              provider = "spotify";
            }
          }
        }

        // If we found a score, save it
        if (score != null && !isNaN(score)) {
          await prisma.popularity.upsert({
            where: { trackId: track.id },
            update: {
              score,
              provider,
              lastUpdated: new Date()
            },
            create: {
              trackId: track.id,
              score,
              provider,
              lastUpdated: new Date()
            }
          });
          
          console.log(`[PopularityEngine] Track "${track.title}" -> ${score} (${provider})`);
        } else {
          // Even if we didn't find one, we should probably mark it so we don't try forever.
          // For now, we'll store a 0 score with provider 'not_found'
          await prisma.popularity.create({
            data: {
              trackId: track.id,
              score: 0,
              provider: "not_found",
              lastUpdated: new Date()
            }
          });
        }
      } catch (e: any) {
        if (e.message === "NO_TOKEN" || e.message?.startsWith("RATE_LIMIT")) {
          // We got rate limited by Spotify (or token failed). Do NOT save an empty row. 
          // Just skip to the next track so this one can be retried on the next run.
        } else {
          console.error(`[PopularityEngine] Unexpected error on track ${track.title}:`, e.message);
        }
      }

      // Respect API rate limits (Especially Last.fm's 5 req/sec)
      // 250ms = 4 requests per second
      await sleep(250);
    }

    console.log("[PopularityEngine] Popularity sync batch completed!");

  } catch (error) {
    console.error("[PopularityEngine] Sync failed", error);
  }
};
