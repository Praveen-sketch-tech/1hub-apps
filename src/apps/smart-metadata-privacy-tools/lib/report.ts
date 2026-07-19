import type { InspectionResult } from './types';

export function buildJsonReport(result: InspectionResult): string {
  const payload = {
    generatedAt: new Date().toISOString(),
    file: result.file,
    metadata: result.groups,
    privacy: result.privacy,
    cleaning: result.cleaning,
    warnings: result.warnings,
  };
  return JSON.stringify(payload, null, 2);
}

export function buildTextReport(result: InspectionResult): string {
  const lines: string[] = [];
  lines.push('Smart Metadata & Privacy Tools — Metadata Report');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push('File');
  lines.push('----');
  lines.push(`Name: ${result.file.name}`);
  lines.push(`Type: ${result.file.type}`);
  lines.push(`Size: ${result.file.size} bytes`);
  if (result.file.lastModified) {
    lines.push(`Last Modified: ${new Date(result.file.lastModified).toLocaleString()}`);
  }
  lines.push('');

  if (result.groups.length) {
    for (const group of result.groups) {
      lines.push(group.title);
      lines.push('-'.repeat(group.title.length));
      for (const f of group.fields) {
        lines.push(`${f.label}: ${f.value}${f.sensitive ? '  [sensitive]' : ''}`);
      }
      lines.push('');
    }
  } else {
    lines.push('No metadata fields were detected in this file.');
    lines.push('');
  }

  lines.push('Privacy Risk Summary');
  lines.push('---------------------');
  lines.push(`Overall risk: ${result.privacy.overall.toUpperCase()}`);
  if (result.privacy.flags.length) {
    for (const flag of result.privacy.flags) {
      lines.push(`- [${flag.level.toUpperCase()}] ${flag.label}: ${flag.reason}`);
    }
  } else {
    lines.push('No privacy-sensitive fields were flagged.');
  }
  lines.push('');

  if (result.warnings.length) {
    lines.push('Notes');
    lines.push('-----');
    for (const w of result.warnings) lines.push(`- ${w}`);
    lines.push('');
  }

  return lines.join('\n');
}
