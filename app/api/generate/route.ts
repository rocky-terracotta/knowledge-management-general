import { z } from "zod";
import { generateArticleDraft } from "@/lib/article";

export const runtime = "nodejs";

const schema = z.object({
  newsRefNo: z.string().min(1),
  personId: z.number().nullable(),
  personIds: z.array(z.number()).optional(),
  anonymize: z.string().default(""),
  requirements: z.string().default(""),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const draft = await generateArticleDraft(parsed.data);
    return Response.json({ draft });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Generation failed." }, { status: 500 });
  }
}
