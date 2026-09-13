/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }]
  },
  async headers() {
    return [
      {
        // Homepage only. Allows the marketing page to be embedded in an
        // iframe exclusively by Kaminski Foundry (kaminskifoundry.pl), while
        // every other origin on the internet stays blocked. No
        // X-Frame-Options is set here: browsers that understand CSP
        // frame-ancestors ignore X-Frame-Options when both are present, and
        // omitting it avoids re-introducing the older, less flexible header.
        // middleware.ts's X-Frame-Options: DENY on /admin, /out and /api is
        // untouched by this and still applies there.
        source: "/",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://kaminskifoundry.pl https://www.kaminskifoundry.pl;"
          }
        ]
      }
    ];
  }
};
module.exports = nextConfig;
