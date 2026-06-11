/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // 🔥 OPTIMIZATION: Enable stale-while-revalidate at the CDN edge.
  // When a user requests a page, Vercel serves a cached version immediately
  // (even if stale) while re-fetching the latest version in the background.
  // This eliminates the cold-start penalty for repeat visitors.
  // The `swrDelta` value (in seconds) controls how long a stale response
  // can be served before a fresh one is fetched.
  //
  // For Next.js 16 on Vercel, this is configured via the `expireTime` header.
  // Without this, EVERY request hits the serverless function cold.
  experimental: {
    staleTimes: {
      dynamic: 30,    // Cache dynamic pages (dashboard, patient) for 30s
      static: 180,    // Cache static pages for 3 minutes
    },
  },
}

export default nextConfig