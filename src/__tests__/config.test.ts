// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextConfig = require('../../next.config.js');

describe('next config', () => {
  it('sends the front page to the games', async () => {
    const rules = await nextConfig.redirects();
    expect(rules).toContainEqual({
      source: '/',
      destination: '/games',
      permanent: false,
    });
  });
});
