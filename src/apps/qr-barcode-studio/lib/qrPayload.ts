// App #003 — QR & Barcode Studio
// Builds the raw string payload encoded inside the QR code for each QR type.

import type { QrData } from '../types';
import { normalizeUrl, escapeWifiField, escapeVCardField } from './validators';

export function buildQrPayload(qr: QrData): string {
  switch (qr.type) {
    case 'url':
      return normalizeUrl(qr.data.url);

    case 'text':
      return qr.data.text;

    case 'phone':
      return `tel:${sanitizePhone(qr.data.phone)}`;

    case 'email': {
      const { email, subject, message } = qr.data;
      const params = new URLSearchParams();
      if (subject) params.set('subject', subject);
      if (message) params.set('body', message);
      const query = params.toString();
      return `mailto:${email}${query ? `?${query}` : ''}`;
    }

    case 'sms': {
      const { phone, message } = qr.data;
      const cleanPhone = sanitizePhone(phone);
      return message
        ? `sms:${cleanPhone}?body=${encodeURIComponent(message)}`
        : `sms:${cleanPhone}`;
    }

    case 'wifi': {
      const { ssid, password, security, hidden } = qr.data;
      const sec = security === 'nopass' ? 'nopass' : security;
      const pass = security === 'nopass' ? '' : `P:${escapeWifiField(password ?? '')};`;
      return `WIFI:T:${sec};S:${escapeWifiField(ssid)};${pass}${hidden ? 'H:true;' : ''};`;
    }

    case 'vcard': {
      const { firstName, lastName, organization, jobTitle, phone, email, website } = qr.data;
      const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      lines.push(`N:${escapeVCardField(lastName ?? '')};${escapeVCardField(firstName)};;;`);
      lines.push(`FN:${escapeVCardField(fullName)}`);
      if (organization) lines.push(`ORG:${escapeVCardField(organization)}`);
      if (jobTitle) lines.push(`TITLE:${escapeVCardField(jobTitle)}`);
      if (phone) lines.push(`TEL;TYPE=CELL:${escapeVCardField(phone)}`);
      if (email) lines.push(`EMAIL:${escapeVCardField(email)}`);
      if (website) lines.push(`URL:${escapeVCardField(normalizeUrl(website))}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }

    default: {
      const exhaustiveCheck: never = qr;
      return exhaustiveCheck;
    }
  }
}

function sanitizePhone(phone: string): string {
  const trimmed = phone.trim();
  // Keep a leading + and digits only.
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  return hasPlus ? `+${digits}` : digits;
}
