const DEFAULT_LITELLM_BASE_URL = "http://localhost:4000/v1";
const DEFAULT_LITELLM_MODEL = "gemini/gemini-3.1-pro";

export function hasLlmConfig(): boolean {
  return Boolean(llmApiKey());
}

export async function generateText(prompt: string, options?: { maxOutputTokens?: number }): Promise<string> {
  const apiKey = llmApiKey();
  if (!apiKey) {
    throw new Error("LITELLM_API_KEY or OPENAI_API_KEY is not configured.");
  }

  const maxTokens = Math.max(options?.maxOutputTokens ?? 1800, 1024);
  const response = await fetch(`${llmBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: llmModel(),
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LiteLLM generation failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((item) => item.text ?? "").join("") : content;

  if (!text?.trim()) {
    throw new Error("LiteLLM generation returned no text.");
  }

  return text.trim();
}

function llmApiKey(): string {
  return process.env.LITELLM_API_KEY || process.env.OPENAI_API_KEY || "";
}

function llmBaseUrl(): string {
  const value = process.env.LITELLM_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_LITELLM_BASE_URL;
  return value.replace(/\/+$/, "");
}

function llmModel(): string {
  return process.env.LITELLM_MODEL || process.env.OPENAI_MODEL || DEFAULT_LITELLM_MODEL;
}
