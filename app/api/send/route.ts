import { Resend } from "resend";
import { z } from "zod";
import { buildClientAlertEmailHtml } from "@/lib/email-template";

export const runtime = "nodejs";

const schema = z.object({
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().default(""),
  recipients: z.array(z.object({ name: z.string().min(1), email: z.string().email() })).min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: "RESEND_API_KEY is not configured." }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "news-alerts@updates.casebyte.ai",
    to: parsed.data.recipients.map((recipient) => recipient.email),
    subject: parsed.data.subject,
    html: buildClientAlertEmailHtml(parsed.data.html),
    text: parsed.data.text || undefined,
  });

  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 502 });
  }

  return Response.json({ id: result.data?.id ?? null });
}
