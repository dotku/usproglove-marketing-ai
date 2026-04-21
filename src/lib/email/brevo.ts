const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export interface SendEmailParams {
  to: { email: string; name?: string };
  from: { email: string; name: string };
  replyTo?: { email: string; name?: string };
  subject: string;
  textContent: string;
  htmlContent: string;
  headers?: Record<string, string>;
  tags?: string[];
}

export interface SendEmailResult {
  providerMessageId: string;
  messageId: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY not set");

  const listUnsubscribe =
    params.headers?.["List-Unsubscribe"] ??
    `<mailto:${params.from.email}?subject=unsubscribe>`;

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: params.from,
      to: [params.to],
      replyTo: params.replyTo,
      subject: params.subject,
      textContent: params.textContent,
      htmlContent: params.htmlContent,
      headers: {
        "List-Unsubscribe": listUnsubscribe,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        ...params.headers,
      },
      tags: params.tags,
    }),
  });

  if (!res.ok) {
    throw new Error(`Brevo send failed ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { messageId: string };
  const messageId = data.messageId.replace(/^<|>$/g, "");
  return { providerMessageId: messageId, messageId };
}
