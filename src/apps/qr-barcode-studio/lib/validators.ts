// App #003 — QR & Barcode Studio
// Input validators for QR payload types and barcode values.

import type { BarcodeFormat, ValidationResult } from '../types';

export function ok(): ValidationResult {
  return { valid: true };
}

export function fail(message: string): ValidationResult {
  return { valid: false, message };
}

/** Normalizes a URL by adding https:// if no protocol is present. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function validateUrl(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return fail('Please enter a website URL.');
  const normalized = normalizeUrl(trimmed);
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fail('Only http:// and https:// URLs are supported.');
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return fail('Please enter a valid website URL, e.g. https://example.com');
    }
    return ok();
  } catch {
    return fail('Please enter a valid website URL, e.g. https://example.com');
  }
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return fail('Please enter an email address.');
  if (!EMAIL_RE.test(trimmed)) return fail('Please enter a valid email address.');
  return ok();
}

export function validatePhone(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return fail('Please enter a phone number.');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 6) return fail('Please enter a valid phone number.');
  return ok();
}

export function validateText(input: string): ValidationResult {
  if (!input || input.trim().length === 0) return fail('Please enter some text.');
  if (input.length > 4000) return fail('Text is too long (max 4000 characters).');
  return ok();
}

export function validateSsid(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return fail('Please enter a network name (SSID).');
  if (trimmed.length > 32) return fail('Network name must be 32 characters or fewer.');
  return ok();
}

export function validateVCard(firstName: string): ValidationResult {
  if (!firstName || !firstName.trim()) return fail('Please enter at least a first name.');
  return ok();
}

/** Escapes characters that are reserved in the Wi-Fi QR payload spec. */
export function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

/** Escapes characters reserved in vCard fields. */
export function escapeVCardField(value: string): string {
  return value.replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');
}

const BARCODE_RULES: Record<BarcodeFormat, { test: (v: string) => ValidationResult; hint: string }> = {
  CODE128: {
    hint: 'Any text or numbers (ASCII).',
    test: (v) => {
      if (!v) return fail('Please enter a value to encode.');
      if (!/^[\x00-\x7F]+$/.test(v)) return fail('CODE128 supports ASCII characters only.');
      return ok();
    },
  },
  CODE39: {
    hint: 'Uppercase letters, digits, and - . $ / + % space.',
    test: (v) => {
      if (!v) return fail('Please enter a value to encode.');
      if (!/^[A-Z0-9\-. $/+%]+$/.test(v)) {
        return fail('CODE39 supports uppercase letters, digits, and - . $ / + % space only.');
      }
      return ok();
    },
  },
  EAN13: {
    hint: '12 or 13 numeric digits.',
    test: (v) => {
      if (!/^\d{12,13}$/.test(v)) return fail('EAN-13 requires 12 or 13 numeric digits.');
      return ok();
    },
  },
  EAN8: {
    hint: '7 or 8 numeric digits.',
    test: (v) => {
      if (!/^\d{7,8}$/.test(v)) return fail('EAN-8 requires 7 or 8 numeric digits.');
      return ok();
    },
  },
  UPC: {
    hint: '11 or 12 numeric digits.',
    test: (v) => {
      if (!/^\d{11,12}$/.test(v)) return fail('UPC-A requires 11 or 12 numeric digits.');
      return ok();
    },
  },
  ITF14: {
    hint: '13 or 14 numeric digits (even length required by ITF).',
    test: (v) => {
      if (!/^\d{13,14}$/.test(v)) return fail('ITF-14 requires 13 or 14 numeric digits.');
      if (v.length % 2 !== 0) return fail('ITF barcodes require an even number of digits.');
      return ok();
    },
  },
};

export function validateBarcodeValue(format: BarcodeFormat, value: string): ValidationResult {
  const trimmed = value.trim();
  return BARCODE_RULES[format].test(trimmed);
}

export function barcodeFormatHint(format: BarcodeFormat): string {
  return BARCODE_RULES[format].hint;
}
