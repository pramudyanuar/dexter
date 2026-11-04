export const siteConfig = {
  title: 'DevRef',
  description:
    'Cheatsheet developer: Git, Next.js, Vercel CLI, shell, pnpm, TypeScript.',
  /** Without additional '/' on the end, e.g. https://example.com */
  url: process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000',
};
