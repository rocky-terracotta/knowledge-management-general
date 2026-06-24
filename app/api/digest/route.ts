import { previewEmailDigest } from "@/lib/sync";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(previewEmailDigest());
}
