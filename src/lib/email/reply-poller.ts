export interface InboundMessage {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  from: { email: string; name?: string };
  subject: string;
  textContent: string;
  htmlContent?: string;
  receivedAt: Date;
}

/**
 * IMAP poll stub — wire up with imapflow + mailparser when REPLY_IMAP_* envs are set.
 * Cron calls pollInbox() every 15 min; each new message is matched to a prospect by
 * inReplyTo → messages.messageId and resumes the outbound workflow.
 */
export async function pollInbox(_since: Date): Promise<InboundMessage[]> {
  if (!process.env.REPLY_IMAP_HOST) return [];
  throw new Error("reply-poller: implement imapflow client before enabling REPLY_IMAP_HOST");
}
