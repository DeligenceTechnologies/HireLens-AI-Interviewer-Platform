// Public marketing links (home page). Kept in one place so they're easy to update.
export const DEMO_URL = "https://cal.com/ankit-singh-uylq2c/deliberatehire-ai";

/** Topics on the public Request access / Contact us forms ("access" is the Request access tab). */
export const INQUIRY_TOPICS = ["access", "demo", "pricing", "partnership", "other"] as const;
export type InquiryTopic = (typeof INQUIRY_TOPICS)[number];
export const INQUIRY_TOPIC_LABEL: Record<InquiryTopic, string> = {
  access: "Access request", demo: "Demo", pricing: "Pricing", partnership: "Partnership", other: "Other",
};
