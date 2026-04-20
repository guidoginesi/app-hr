import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['resend'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'galmfdqysnhmvzefidma.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      // Redirect pow-apps.com and www.pow-apps.com → hr.pow-apps.com (preserving path)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'pow-apps.com' }],
        destination: 'https://hr.pow-apps.com/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.pow-apps.com' }],
        destination: 'https://hr.pow-apps.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
