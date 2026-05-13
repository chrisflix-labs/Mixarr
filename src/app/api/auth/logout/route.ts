import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  cookies().delete("plexmix_session");
  return NextResponse.json({ status: "success" });
}
