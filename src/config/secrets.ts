// Central secret resolution — the ONLY place API keys are named.
//
// Precedence (first non-empty wins):
//   1. Runtime override — injected by a secure store (Android Keystore / iOS
//      Keychain) once that native module lands. `setSecret()` is the hook.
//   2. Environment variable — `process.env.FRIDAY_<KEY>`. Available in Node/Jest
//      directly, and in React Native when wired through react-native-dotenv /
//      react-native-config (both populate `process.env` at build time).
//   3. Dev-only fallback — lets the app run out-of-the-box during development.
//
// SECURITY: the dev fallbacks below are NOT secrets-grade. Before any public or
// committed release, supply keys via env or secure storage and rotate anything
// that shipped as a dev fallback. Keeping the literal in exactly one file (here)
// is what makes that rotation a one-line change instead of a repo-wide hunt.

export type SecretKey = 'GROQ_API_KEY' | 'NVIDIA_API_KEY' | 'OPENAI_API_KEY';

// Dev-only fallbacks. Empty string means "no default — must come from env/store".
const DEV_FALLBACKS: Record<SecretKey, string> = {
  GROQ_API_KEY: '',
  NVIDIA_API_KEY: '',
  OPENAI_API_KEY: '',
};

const runtimeOverrides: Partial<Record<SecretKey, string>> = {};

// Inject a secret at runtime (e.g. after reading it from a native secure store).
// Overrides both env and dev fallback for that key.
export function setSecret(key: SecretKey, value: string): void {
  if (value) runtimeOverrides[key] = value;
}

function fromEnv(key: SecretKey): string {
  const env = typeof process !== 'undefined' && process.env ? process.env : ({} as Record<string, string>);
  return env[`FRIDAY_${key}`] || '';
}

// Resolve a secret through the precedence chain above.
export function getSecret(key: SecretKey): string {
  return runtimeOverrides[key] || fromEnv(key) || DEV_FALLBACKS[key];
}
