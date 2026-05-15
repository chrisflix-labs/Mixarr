import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generatePlaylistTracks, playlistConfigSchema } from "@/lib/playlistService";

export async function POST(req: Request) {
  const cookieStore = cookies();
  const userId = cookieStore.get("mixarr_session")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const config = playlistConfigSchema.parse(body);
    const tracks = await generatePlaylistTracks({
      userId,
      config,
    });

    return NextResponse.json({ tracks });
  } catch (error: any) {
    console.error("Generate error:", error);
    const status = error.name === "ZodError" ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? "Invalid playlist rules" : "Failed to generate playlist" }, { status });
  }
}
