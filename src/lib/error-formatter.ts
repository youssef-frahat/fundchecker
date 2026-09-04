/**
 * Enterprise Operational Error Formatter
 * Converts raw developer/PostgreSQL/HTTP technical errors into
 * clean, clear, human-understandable business messages.
 */

export function formatUserFriendlyError(rawError: unknown): string {
  if (!rawError) return 'An operational notice occurred. Please try again.';

  const msg = typeof rawError === 'string' ? rawError : (rawError as Error).message || String(rawError);

  // Four-Eyes Principle / Maker-Checker Guards
  if (msg.includes('Four-Eyes') || msg.includes('Maker cannot approve') || msg.includes('cannot approve their own')) {
    return 'Maker-Checker Policy Violation: The user who created or submitted this sheet cannot approve it. An independent checker must review and sign off.';
  }

  // Session / Authentication
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Valid authenticated session required')) {
    return 'Your operational session has expired or is invalid. Please refresh the page and sign in again.';
  }

  // Permissions / Access Control
  if (msg.includes('403') || msg.includes('Forbidden') || msg.includes('Only Super Administrators')) {
    return 'Access Restricted: You do not have the required administrative permissions to perform this operation.';
  }

  // Duplicate Records / File Re-upload
  if (msg.includes('duplicate key') || msg.includes('unique constraint') || msg.includes('already exists')) {
    return 'Duplicate Ingestion Detected: This file or record is already registered in the system to prevent double-counting financial transactions.';
  }

  // File Uploads & Constraints
  if (msg.includes('threshold of 100MB') || msg.includes('exceeds maximum')) {
    return 'File Size Exceeded: The selected Excel spreadsheet exceeds the 100MB upload threshold.';
  }
  if (msg.includes('No valid trading transactions found') || msg.includes('empty or placeholder')) {
    return 'Invalid Spreadsheet Format: No valid customer trading orders or allocations could be parsed from this file. Please verify sheet headers.';
  }
  if (msg.includes('File record not found')) {
    return 'File Not Located: The requested spreadsheet record was not found in the ingestion archive.';
  }

  // Database / Network Connectivity
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch failed') || msg.includes('timeout')) {
    return 'Database Connection Unavailable: Unable to communicate with the central database server. Please check network connectivity.';
  }

  // Identifier / UUID Syntax
  if (msg.includes('invalid input syntax for type uuid') || msg.includes('uuid')) {
    return 'Data Reference Error: An unexpected identifier format was encountered while processing this record.';
  }

  // Mandatory Reason
  if (msg.includes('Mandatory audit justification reason') || msg.includes('justification')) {
    return 'Mandatory Audit Reason: An operational justification reason is required to document this regulatory action.';
  }

  // Clean fallback: strip raw technical tags
  return msg
    .replace(/^\[.*?\]\s*/, '')
    .replace(/^Error:\s*/i, '')
    .trim();
}
