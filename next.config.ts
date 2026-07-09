import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER || '51999000000',
  },
  experimental: {
    swcTraceProfiling: false,
  },
};

export default nextConfig;
