// Free trials need a company email address: personal mailboxes and throwaway
// services are turned away. Matching is on the domain and its parent domains
// (so "mail.yahoo.co.in" matches "yahoo.co.in").

const PERSONAL = [
  // Global webmail
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "yahoo.in", "ymail.com", "rocketmail.com",
  "hotmail.com", "hotmail.co.uk", "hotmail.in", "outlook.com", "outlook.in", "live.com", "live.in", "msn.com", "windowslive.com",
  "aol.com", "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "pm.me", "tutanota.com", "tuta.io",
  "gmx.com", "gmx.net", "gmx.de", "web.de", "mail.com", "email.com", "zoho.com", "zohomail.com", "zohomail.in",
  "yandex.com", "yandex.ru", "mail.ru", "inbox.com", "fastmail.com", "hey.com", "duck.com",
  // Regional
  "rediffmail.com", "rediff.com", "sify.com", "qq.com", "163.com", "126.com", "sina.com", "naver.com", "daum.net",
  "libero.it", "orange.fr", "free.fr", "laposte.net", "t-online.de", "btinternet.com", "comcast.net", "verizon.net", "att.net",
  // Throwaway
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "sharklasers.com", "10minutemail.com", "temp-mail.org",
  "tempmail.com", "yopmail.com", "trashmail.com", "dispostable.com", "getnada.com", "maildrop.cc", "throwawaymail.com",
  "mailnesia.com", "mintemail.com", "fakeinbox.com", "emailondeck.com", "mohmal.com", "moakt.com", "burnermail.io",
];
const BLOCKED = new Set(PERSONAL);

export function emailDomain(email: string) {
  return email.trim().toLowerCase().split("@").pop() ?? "";
}

/** True for a company address; false for personal mailboxes and throwaway services. */
export function isWorkEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain.includes(".")) return false;
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (BLOCKED.has(parts.slice(i).join("."))) return false;
  return true;
}

export const WORK_EMAIL_MESSAGE = "Please use your work email (personal addresses like Gmail or Yahoo can't start a free trial).";
