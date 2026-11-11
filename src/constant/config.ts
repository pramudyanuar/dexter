export const siteConfig = {
  title: 'Games',
  description: 'Game santai untuk dimainkan sendiri atau bareng teman.',
  /** Without additional '/' on the end, e.g. https://example.com */
  url: process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000',
};
