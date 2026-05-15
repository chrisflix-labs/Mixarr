import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

function plexHeaders(accessToken: string, range?: string | null, accept = "application/json") {
  return {
    Accept: accept,
    "X-Plex-Token": accessToken,
    "X-Plex-Client-Identifier": (process.env.PLEX_CLIENT_IDENTIFIER || "mixarr").trim(),
    ...(range ? { Range: range } : {}),
  };
}

function copyHeader(source: Headers, target: Headers, name: string) {
  const value = source.get(name);
  if (value) target.set(name, value);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const userId = cookieStore.get("mixarr_session")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const track = await prisma.track.findFirst({
    where: {
      id: params.id,
      library: {
        server: {
          userId,
        },
      },
    },
    include: {
      library: {
        include: {
          server: true,
        },
      },
    },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const server = track.library.server;
  const metadataResponse = await fetch(`${server.uri}/library/metadata/${track.ratingKey || track.plexId}`, {
    headers: plexHeaders(server.accessToken),
  });

  if (!metadataResponse.ok) {
    return NextResponse.json({ error: "Unable to load Plex metadata" }, { status: 502 });
  }

  const metadata = await metadataResponse.json();
  const media = metadata?.MediaContainer?.Metadata?.[0]?.Media || [];
  const part = media.flatMap((item: any) => item.Part || [])[0];
  const partKey = part?.key;

  if (!partKey) {
    return NextResponse.json({ error: "No playable media part found" }, { status: 404 });
  }

  const mediaUrl = new URL(partKey, server.uri);
  const range = req.headers.get("range");
  const streamResponse = await fetch(mediaUrl, {
    headers: plexHeaders(server.accessToken, range, "*/*"),
  });

  if (!streamResponse.ok && streamResponse.status !== 206) {
    return NextResponse.json({ error: "Unable to stream Plex preview" }, { status: 502 });
  }

  const headers = new Headers();
  copyHeader(streamResponse.headers, headers, "content-type");
  copyHeader(streamResponse.headers, headers, "content-length");
  copyHeader(streamResponse.headers, headers, "content-range");
  copyHeader(streamResponse.headers, headers, "accept-ranges");
  headers.set("Cache-Control", "private, max-age=300");

  return new Response(streamResponse.body, {
    status: streamResponse.status,
    headers,
  });
}
