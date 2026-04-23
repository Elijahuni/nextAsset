/** @type {import('next').NextConfig} */
const nextConfig = {
  // 같은 Wi-Fi 네트워크의 모바일 기기에서 개발 서버 접근 허용
  allowedDevOrigins: ['172.30.1.45', '172.30.1.*'],
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
