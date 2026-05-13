import axios from "axios";

export const getDeezerPopularity = async (artist: string, track: string): Promise<number | null> => {
  try {
    const query = `artist:"${artist}" track:"${track}"`;
    const response = await axios.get("https://api.deezer.com/search", {
      params: { q: query, limit: 1 },
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      const rank = response.data.data[0].rank; // 0 to 1,000,000
      
      // Normalize Deezer Rank (0 - 1M) to 0-100 scale
      // Note: Rank scales logarithmically, so 500k is huge, 100k is popular
      const normalizedScore = Math.min(100, Math.max(0, (rank / 1000000) * 100));
      return Number(normalizedScore.toFixed(2));
    }

    return null;
  } catch (error) {
    console.error(`Deezer fetch failed for ${artist} - ${track}`);
    return null;
  }
};
