export const DIDIT_CONFIG = {
  apiKey: process.env.DIDIT_API_KEY || "",
  workflowId: process.env.DIDIT_WORKFLOW_ID || "",
  webhookSecret: process.env.DIDIT_WEBHOOK_SECRET || "",
  callbackUrl: process.env.DIDIT_CALLBACK_URL || "",
  apiBaseUrl: "https://verification.didit.me/v3",
};

export function isDiditConfigured(): boolean {
  // Returns true only if both API key and Workflow ID are provided and aren't placeholders
  return (
    !!DIDIT_CONFIG.apiKey &&
    !!DIDIT_CONFIG.workflowId &&
    DIDIT_CONFIG.apiKey !== "YOUR_API_KEY" &&
    DIDIT_CONFIG.workflowId !== "YOUR_WORKFLOW_ID"
  );
}
