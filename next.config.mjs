/** @type {import('next').NextConfig} */
const nextConfig = {
  // 개발 환경에서만 같은 Wi-Fi 네트워크의 모바일 기기에서 접근 허용 (프로덕션 빌드 시 무시)
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['172.30.1.45', '172.30.1.*'],
  }),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
