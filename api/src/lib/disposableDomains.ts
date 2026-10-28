/**
 * Disposable / throwaway email domains we refuse to send sign-in links to.
 *
 * With passwordless sign-in the email address IS the account, so a throwaway
 * address means a throwaway account that can never be recovered or contacted.
 * This list is deliberately conservative: it covers the well-known throwaway
 * services and nothing else. Consumer mailbox providers that real customers
 * actually use -- gmail, hotmail, outlook, live, msn, yahoo, icloud, aol, gmx,
 * proton, zoho -- are NOT here and must never be added.
 *
 * Kept as a static list on purpose. A third-party lookup service would put an
 * external dependency in the signup path, and a stale list that lets a few
 * addresses through is a far smaller problem than an outage that lets nobody in.
 */
const DISPOSABLE_DOMAINS = new Set<string>([
  "0-mail.com",
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "33mail.com",
  "anonaddy.com",
  "anonbox.net",
  "burnermail.io",
  "byom.de",
  "dispostable.com",
  "dropmail.me",
  "e4ward.com",
  "emailondeck.com",
  "emailsensei.com",
  "fakeinbox.com",
  "fakemail.net",
  "fakemailgenerator.com",
  "getairmail.com",
  "getnada.com",
  "grr.la",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "harakirimail.com",
  "inboxalias.com",
  "inboxbear.com",
  "incognitomail.com",
  "jetable.org",
  "mail-temporaire.fr",
  "mail7.io",
  "mailbox52.gq",
  "mailcatch.com",
  "maildrop.cc",
  "maileater.com",
  "mailforspam.com",
  "mailinator.com",
  "mailinator.net",
  "mailnesia.com",
  "mailnull.com",
  "mailsac.com",
  "mailtemp.info",
  "mailtothis.com",
  "meltmail.com",
  "mintemail.com",
  "moakt.com",
  "mohmal.com",
  "mytemp.email",
  "mytrashmail.com",
  "nowmymail.com",
  "nwytg.net",
  "onetimemail.org",
  "pokemail.net",
  "quickinbox.com",
  "rcpt.at",
  "sharklasers.com",
  "shieldedmail.com",
  "sneakemail.com",
  "spam4.me",
  "spamgourmet.com",
  "spamhole.com",
  "spamex.com",
  "tempail.com",
  "tempemail.net",
  "tempinbox.com",
  "tempmail.de",
  "tempmail.net",
  "tempmail.plus",
  "tempmailaddress.com",
  "tempmailo.com",
  "temp-mail.io",
  "temp-mail.org",
  "temporary-mail.net",
  "throwawaymail.com",
  "trash-mail.com",
  "trashmail.com",
  "trashmail.de",
  "trashmail.me",
  "trashmail.net",
  "tmail.ws",
  "tmpmail.net",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "zerobounce.net",
  "zetmail.com",
]);

/**
 * True when the address belongs to a known throwaway mail service.
 *
 * Matches the exact domain and any subdomain of it, because several of these
 * services hand out addresses on arbitrary subdomains (e.g. `x.mailinator.com`).
 */
export function isDisposableEmailDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Subdomain match: foo.mailinator.com -> mailinator.com
  return [...DISPOSABLE_DOMAINS].some((blocked) => domain.endsWith(`.${blocked}`));
}

export const DISPOSABLE_DOMAIN_COUNT = DISPOSABLE_DOMAINS.size;
