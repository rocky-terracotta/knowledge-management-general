const DEFAULT_LITELLM_BASE_URL = "http://localhost:4000/v1";
const DEFAULT_LITELLM_MODEL = "gemini/gemini-3.1-pro";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4.1";

export function hasLlmConfig(): boolean {
  return Boolean(llmApiKey());
}

export async function generateText(prompt: string, options?: { maxOutputTokens?: number }): Promise<string> {
  const config = llmConfig();

  const maxTokens = Math.max(options?.maxOutputTokens ?? 1800, 1024);
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM generation failed at ${config.baseUrl}: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((item) => item.text ?? "").join("") : content;

  if (!text?.trim()) {
    throw new Error("LLM generation returned no text.");
  }

  return text.trim();
}

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

function llmConfig(): LlmConfig {
  const litellmApiKey = process.env.LITELLM_API_KEY || "";
  const openaiApiKey = process.env.OPENAI_API_KEY || "";

  if (litellmApiKey) {
    const baseUrl = (process.env.LITELLM_BASE_URL || DEFAULT_LITELLM_BASE_URL).replace(/\/+$/, "");
    assertReachableFromVercel(baseUrl, "LITELLM_BASE_URL");
    return {
      apiKey: litellmApiKey,
      baseUrl,
      model: process.env.LITELLM_MODEL || DEFAULT_LITELLM_MODEL,
    };
  }

  if (openaiApiKey) {
    const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
    assertReachableFromVercel(baseUrl, "OPENAI_BASE_URL");
    return {
      apiKey: openaiApiKey,
      baseUrl,
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    };
  }

  throw new Error("No LLM API key configured. Set LITELLM_API_KEY with a public LITELLM_BASE_URL, or set OPENAI_API_KEY.");
}

function assertReachableFromVercel(baseUrl: string, envName: string): void {
  if (!process.env.VERCEL) return;
  const url = new URL(baseUrl);
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host);

  if (privateHost) {
    throw new Error(`${envName} points to ${baseUrl}, which Vercel cannot reach. Use a public HTTPS LiteLLM URL or configure OPENAI_API_KEY.`);
  }
}

function llmApiKey(): string {
  return process.env.LITELLM_API_KEY || process.env.OPENAI_API_KEY || "";
}
