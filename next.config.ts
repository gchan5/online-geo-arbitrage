import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.mercdn.net' },
      { protocol: 'https', hostname: '**.mercari.com' },
      { protocol: 'https', hostname: '**.ebaystatic.com' },
      { protocol: 'https', hostname: '**.ebayimg.com' },
    ],
  },
}

export default nextConfig
