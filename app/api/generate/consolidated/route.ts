import { z } from "zod";
import { generateConsolidatedArticleDraft } from "@/lib/article";

export const runtime = "nodejs";

const schema = z.object({
  newsRefNos: z.array(z.string().min(1)).min(1).max(5),
  personIds: z.array(z.number()).default([]),
  anonymize: z.string().default(""),
  requirements: z.string().default(""),
  promptDirections: z.record(z.string(), z.array(z.string())).default({}),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const draft = await generateConsolidatedArticleDraft(parsed.data);
    return Response.json({ draft });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Generation failed." }, { status: 500 });
  }
}
