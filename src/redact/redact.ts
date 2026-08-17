import { RawText, RedactResult, SafeText, unsafeMakeSafeText } from '../types.js';
import { SECRET_PATTERNS } from './patterns.js';

/**
 * Mandated Redaction Pass-through Engine.
 * 
 * Every collector returns RawText, and only this function can produce SafeText.
 * Bias toward over-redaction.
 */
export function redact(input: RawText | string, extraPatterns?: RegExp[]): RedactResult {
  if (!input) {
    return {
      text: unsafeMakeSafeText(''),
      count: 0,
    };
  }

  let current = String(input);
  let totalRedactions = 0;

  // Run predefined gitleaks-based secret patterns
  for (const pattern of SECRET_PATTERNS) {
    // Reset regex index if global
    pattern.regex.lastIndex = 0;

    if (typeof pattern.replacement === 'function') {
      current = current.replace(pattern.regex, (match, ...args) => {
        const res = (pattern.replacement as Function)(match, ...args);
        if (res !== match) {
          totalRedactions++;
        }
        return res;
      });
    } else {
      const rep = pattern.replacement ?? '[redacted]';
      current = current.replace(pattern.regex, (match) => {
        if (match !== rep) {
          totalRedactions++;
        }
        return rep;
      });
    }
  }

  // Run any user-supplied extra patterns
  if (extraPatterns && extraPatterns.length > 0) {
    for (const regex of extraPatterns) {
      regex.lastIndex = 0;
      current = current.replace(regex, (match) => {
        if (match !== '[redacted]') {
          totalRedactions++;
        }
        return '[redacted]';
      });
    }
  }

  return {
    text: unsafeMakeSafeText(current),
    count: totalRedactions,
  };
}
