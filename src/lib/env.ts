// Environment Configuration & Validation Layer
// Enforces Zero-Trust Secret Management — Zero Hardcoded Fallbacks in Production

export interface ValidatedEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey?: string;
}

/**
 * Validates and extracts required environment variables.
 * Throws an explicit error if critical credentials are missing, preventing silent fallback vulnerabilities.
 */
export function getValidatedEnv(): ValidatedEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error(
      '[CRITICAL CONFIGURATION ERROR] Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. ' +
      'Ensure it is defined in .env.local or your production deployment environment.'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      '[CRITICAL CONFIGURATION ERROR] Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Ensure it is defined in .env.local or your production deployment environment.'
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
  };
}
