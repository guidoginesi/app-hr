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
      // Redirige pow-apps.com/jobs/* → hr.pow-apps.com/jobs/* (301 permanente)
      // Migra los links públicos de ofertas laborales a la URL canónica del subdominio
      {
        source: '/jobs/:path*',
        has: [{ type: 'host', value: 'pow-apps.com' }],
        destination: 'https://hr.pow-apps.com/jobs/:path*',
        permanent: true,
      },
      {
        source: '/jobs/:path*',
        has: [{ type: 'host', value: 'www.pow-apps.com' }],
        destination: 'https://hr.pow-apps.com/jobs/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
