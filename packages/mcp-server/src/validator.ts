import type { CapturedElementData } from '@chrome-agent-bridge/shared';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that the given data conforms to the CapturedElementData structure.
 * Returns a validation result with specific error messages for each invalid field.
 */
export function validateCapturedElementData(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Data must be a non-null object'] };
  }

  const d = data as Record<string, unknown>;

  // Required string fields
  if (typeof d.url !== 'string') {
    errors.push('Missing or invalid field: url (expected string)');
  }
  if (typeof d.title !== 'string') {
    errors.push('Missing or invalid field: title (expected string)');
  }

  // screenshot: string | null
  if (d.screenshot !== null && typeof d.screenshot !== 'string') {
    errors.push('Invalid field: screenshot (expected string or null)');
  }

  // element validation
  if (d.element === null || typeof d.element !== 'object' || Array.isArray(d.element)) {
    errors.push('Missing or invalid field: element (expected object)');
  } else {
    const el = d.element as Record<string, unknown>;
    if (typeof el.tagName !== 'string') {
      errors.push('Missing or invalid field: element.tagName (expected string)');
    }
    if (typeof el.html !== 'string') {
      errors.push('Missing or invalid field: element.html (expected string)');
    }
    if (typeof el.text !== 'string') {
      errors.push('Missing or invalid field: element.text (expected string)');
    }
    if (!Array.isArray(el.classes) || !el.classes.every((c: unknown) => typeof c === 'string')) {
      errors.push('Missing or invalid field: element.classes (expected string[])');
    }
    if (el.id !== null && typeof el.id !== 'string') {
      errors.push('Invalid field: element.id (expected string or null)');
    }
    if (el.attributes === null || typeof el.attributes !== 'object' || Array.isArray(el.attributes)) {
      errors.push('Missing or invalid field: element.attributes (expected object)');
    }
    if (typeof el.domPath !== 'string') {
      errors.push('Missing or invalid field: element.domPath (expected string)');
    }
  }

  // styles validation
  if (d.styles === null || typeof d.styles !== 'object' || Array.isArray(d.styles)) {
    errors.push('Missing or invalid field: styles (expected object)');
  } else {
    const st = d.styles as Record<string, unknown>;
    if (st.computed === null || typeof st.computed !== 'object' || Array.isArray(st.computed)) {
      errors.push('Missing or invalid field: styles.computed (expected object)');
    }
    if (!Array.isArray(st.matched)) {
      errors.push('Missing or invalid field: styles.matched (expected array)');
    }
  }

  return { valid: errors.length === 0, errors };
}
