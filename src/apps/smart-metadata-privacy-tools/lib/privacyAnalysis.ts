import type { MetadataGroup, PrivacyFlag, PrivacyRiskSummary, RiskLevel } from './types';

const RISK_ORDER: RiskLevel[] = ['low', 'medium', 'high'];

function higher(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}

/**
 * Builds a privacy risk summary from detected metadata groups. Each sensitive
 * field becomes an explained flag; the overall level is the highest
 * individual flag level found. This is a heuristic, not a security audit.
 */
export function analyzePrivacyRisk(groups: MetadataGroup[]): PrivacyRiskSummary {
  const flags: PrivacyFlag[] = [];

  for (const group of groups) {
    for (const f of group.fields) {
      if (!f.sensitive) continue;

      let level: RiskLevel = 'medium';
      if (/gps/i.test(f.key)) level = 'high';
      else if (/date|time/i.test(f.key)) level = 'medium';
      else if (/make|model|software|creator|producer/i.test(f.key)) level = 'low';
      else if (/artist|author/i.test(f.key)) level = 'medium';

      flags.push({
        key: f.key,
        label: f.label,
        level,
        reason: f.note ?? `${f.label} was found and may reveal information about you or your device.`,
      });
    }
  }

  const overall = flags.reduce<RiskLevel>((acc, flag) => higher(acc, flag.level), 'low');

  return { overall, flags: flags.length ? flags : [] };
}
