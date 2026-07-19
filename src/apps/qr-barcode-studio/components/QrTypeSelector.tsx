// App #003 — QR & Barcode Studio
// QR type selector + per-type data entry forms.

import React, { FC } from 'react';
import type { QrData, QrType, WifiSecurity } from '../types';

const QR_TYPES: { id: QrType; label: string }[] = [
  { id: 'url', label: 'URL' },
  { id: 'text', label: 'Text' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'vcard', label: 'Contact' },
];

interface QrTypeSelectorProps {
  activeType: QrType;
  onSelect: (type: QrType) => void;
}

export const QrTypeSelector: FC<QrTypeSelectorProps> = ({ activeType, onSelect }) => {
  return (
    <div className="qbs-type-grid" role="radiogroup" aria-label="QR code type">
      {QR_TYPES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={activeType === t.id}
          aria-pressed={activeType === t.id}
          className="qbs-type-btn"
          onClick={() => onSelect(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};

interface QrDataFormProps {
  value: QrData;
  onChange: (value: QrData) => void;
  errorMessage: string | null;
}

export const QrDataForm: FC<QrDataFormProps> = ({ value, onChange, errorMessage }) => {
  return (
    <div>
      {value.type === 'url' && (
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-url-input">
            Website URL
          </label>
          <input
            id="qbs-url-input"
            className="qbs-input"
            type="text"
            placeholder="https://example.com"
            value={value.data.url}
            onChange={(e) => onChange({ type: 'url', data: { url: e.target.value } })}
          />
        </div>
      )}

      {value.type === 'text' && (
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-text-input">
            Text
          </label>
          <textarea
            id="qbs-text-input"
            className="qbs-textarea"
            placeholder="Type anything..."
            maxLength={4000}
            value={value.data.text}
            onChange={(e) => onChange({ type: 'text', data: { text: e.target.value } })}
          />
          <div className="qbs-char-count">{value.data.text.length} / 4000</div>
        </div>
      )}

      {value.type === 'phone' && (
        <div className="qbs-field">
          <label className="qbs-label" htmlFor="qbs-phone-input">
            Phone number
          </label>
          <input
            id="qbs-phone-input"
            className="qbs-input"
            type="tel"
            placeholder="+919876543210"
            value={value.data.phone}
            onChange={(e) => onChange({ type: 'phone', data: { phone: e.target.value } })}
          />
        </div>
      )}

      {value.type === 'email' && (
        <>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-email-input">
              Email address
            </label>
            <input
              id="qbs-email-input"
              className="qbs-input"
              type="email"
              placeholder="name@example.com"
              value={value.data.email}
              onChange={(e) =>
                onChange({ type: 'email', data: { ...value.data, email: e.target.value } })
              }
            />
          </div>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-email-subject">
              Subject (optional)
            </label>
            <input
              id="qbs-email-subject"
              className="qbs-input"
              type="text"
              value={value.data.subject ?? ''}
              onChange={(e) =>
                onChange({ type: 'email', data: { ...value.data, subject: e.target.value } })
              }
            />
          </div>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-email-message">
              Message (optional)
            </label>
            <textarea
              id="qbs-email-message"
              className="qbs-textarea"
              value={value.data.message ?? ''}
              onChange={(e) =>
                onChange({ type: 'email', data: { ...value.data, message: e.target.value } })
              }
            />
          </div>
        </>
      )}

      {value.type === 'sms' && (
        <>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-sms-phone">
              Phone number
            </label>
            <input
              id="qbs-sms-phone"
              className="qbs-input"
              type="tel"
              placeholder="+919876543210"
              value={value.data.phone}
              onChange={(e) =>
                onChange({ type: 'sms', data: { ...value.data, phone: e.target.value } })
              }
            />
          </div>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-sms-message">
              Message
            </label>
            <textarea
              id="qbs-sms-message"
              className="qbs-textarea"
              value={value.data.message ?? ''}
              onChange={(e) =>
                onChange({ type: 'sms', data: { ...value.data, message: e.target.value } })
              }
            />
          </div>
        </>
      )}

      {value.type === 'wifi' && (
        <>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-wifi-ssid">
              Network name (SSID)
            </label>
            <input
              id="qbs-wifi-ssid"
              className="qbs-input"
              type="text"
              value={value.data.ssid}
              onChange={(e) =>
                onChange({ type: 'wifi', data: { ...value.data, ssid: e.target.value } })
              }
            />
          </div>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-wifi-security">
              Security
            </label>
            <select
              id="qbs-wifi-security"
              className="qbs-select"
              value={value.data.security}
              onChange={(e) =>
                onChange({
                  type: 'wifi',
                  data: { ...value.data, security: e.target.value as WifiSecurity },
                })
              }
            >
              <option value="WPA">WPA/WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">None (open network)</option>
            </select>
          </div>
          {value.data.security !== 'nopass' && (
            <div className="qbs-field">
              <label className="qbs-label" htmlFor="qbs-wifi-password">
                Password
              </label>
              <input
                id="qbs-wifi-password"
                className="qbs-input"
                type="text"
                value={value.data.password ?? ''}
                onChange={(e) =>
                  onChange({ type: 'wifi', data: { ...value.data, password: e.target.value } })
                }
              />
            </div>
          )}
          <div className="qbs-field qbs-checkbox-row">
            <input
              id="qbs-wifi-hidden"
              type="checkbox"
              checked={value.data.hidden}
              onChange={(e) =>
                onChange({ type: 'wifi', data: { ...value.data, hidden: e.target.checked } })
              }
            />
            <label className="qbs-label" htmlFor="qbs-wifi-hidden" style={{ marginBottom: 0 }}>
              Hidden network
            </label>
          </div>
        </>
      )}

      {value.type === 'vcard' && (
        <>
          <div className="qbs-row">
            <div className="qbs-field">
              <label className="qbs-label" htmlFor="qbs-vcard-first">
                First name
              </label>
              <input
                id="qbs-vcard-first"
                className="qbs-input"
                type="text"
                value={value.data.firstName}
                onChange={(e) =>
                  onChange({ type: 'vcard', data: { ...value.data, firstName: e.target.value } })
                }
              />
            </div>
            <div className="qbs-field">
              <label className="qbs-label" htmlFor="qbs-vcard-last">
                Last name
              </label>
              <input
                id="qbs-vcard-last"
                className="qbs-input"
                type="text"
                value={value.data.lastName ?? ''}
                onChange={(e) =>
                  onChange({ type: 'vcard', data: { ...value.data, lastName: e.target.value } })
                }
              />
            </div>
          </div>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-vcard-org">
              Organization
            </label>
            <input
              id="qbs-vcard-org"
              className="qbs-input"
              type="text"
              value={value.data.organization ?? ''}
              onChange={(e) =>
                onChange({ type: 'vcard', data: { ...value.data, organization: e.target.value } })
              }
            />
          </div>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-vcard-title">
              Job title
            </label>
            <input
              id="qbs-vcard-title"
              className="qbs-input"
              type="text"
              value={value.data.jobTitle ?? ''}
              onChange={(e) =>
                onChange({ type: 'vcard', data: { ...value.data, jobTitle: e.target.value } })
              }
            />
          </div>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-vcard-phone">
              Phone
            </label>
            <input
              id="qbs-vcard-phone"
              className="qbs-input"
              type="tel"
              value={value.data.phone ?? ''}
              onChange={(e) =>
                onChange({ type: 'vcard', data: { ...value.data, phone: e.target.value } })
              }
            />
          </div>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-vcard-email">
              Email
            </label>
            <input
              id="qbs-vcard-email"
              className="qbs-input"
              type="email"
              value={value.data.email ?? ''}
              onChange={(e) =>
                onChange({ type: 'vcard', data: { ...value.data, email: e.target.value } })
              }
            />
          </div>
          <div className="qbs-field">
            <label className="qbs-label" htmlFor="qbs-vcard-website">
              Website
            </label>
            <input
              id="qbs-vcard-website"
              className="qbs-input"
              type="text"
              value={value.data.website ?? ''}
              onChange={(e) =>
                onChange({ type: 'vcard', data: { ...value.data, website: e.target.value } })
              }
            />
          </div>
        </>
      )}

      {errorMessage && (
        <div className="qbs-error" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
