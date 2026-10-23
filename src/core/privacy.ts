/**
 * Privacy filtering per 152-FZ (Federal Law on Personal Data Protection).
 * Strips or masks phone numbers, personal email addresses and contact credentials
 * from job/gig descriptions to prevent leaking personal information.
 */

// Matches Russian and international phone numbers:
// +7 (999) 123-45-67, 8 999 123 45 67, +7(495) 517-80-80 (36-290), 8-800-200-00-00, +79964502910
const PHONE_PATTERN = /(?:(?:\+?7|8)[\s(-]*)?(?:\(?\d{3,4}\)?[\s)-]*)\d{3}[\s-]*\d{2}[\s-]*\d{2}(?:\s*(?:\(?[0-9-]+\)?|доб\.?\s*\d+))?/gi;

// Matches email addresses
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export function sanitizePrivacy(input: string): string {
  if (!input) return '';

  return input
    .replace(EMAIL_PATTERN, '[email скрыт (152-ФЗ)]')
    .replace(PHONE_PATTERN, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 22) {
        return '[телефон скрыт (152-ФЗ)]';
      }
      return match;
    });
}

/**
 * Extracts a /24 IPv4 subnet or /48 IPv6 subnet prefix from an IP address
 * to prevent sybil attack / single-actor spam sniping.
 */
export function extractSubnet24(ip: string | undefined): string {
  if (!ip) return '127.0.0.0/24';
  const first = ip.split(',')[0];
  const cleanIp = (first ?? '').trim();
  const ipv4Parts = cleanIp.split('.');
  if (ipv4Parts.length === 4 && ipv4Parts[0] && ipv4Parts[1] && ipv4Parts[2]) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.${ipv4Parts[2]}.0/24`;
  }
  if (cleanIp.includes(':')) {
    const v6Parts = cleanIp.split(':');
    return `${v6Parts.slice(0, 3).join(':')}::/48`;
  }
  return 'unknown/24';
}
