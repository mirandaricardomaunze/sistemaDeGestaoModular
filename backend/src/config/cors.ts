import { env } from './env';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://sistema-de-gestao-modular-frontend.vercel.app',
];

const VERCEL_PREVIEW_SUFFIX = '-mirandaricardomaunze.vercel.app';

export const allowedCorsOrigins = Array.from(
  new Set([...DEFAULT_ALLOWED_ORIGINS, ...env.ALLOWED_ORIGINS])
);

export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;

  return (
    allowedCorsOrigins.includes(origin) ||
    origin.endsWith(VERCEL_PREVIEW_SUFFIX)
  );
}
