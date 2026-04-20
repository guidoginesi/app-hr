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
};

export default nextConfig;
