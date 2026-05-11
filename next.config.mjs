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

  experimental: {
    // xlsx(SheetJS)는 Node.js 전용 대형 패키지 — Vercel 함수 번들링 시
    // 정적 분석으로 누락되는 것을 방지하기 위해 외부 패키지로 명시
    // Next.js 14: experimental.serverComponentsExternalPackages
    // Next.js 15+: serverExternalPackages (top-level)
    serverComponentsExternalPackages: ['xlsx'],
  },
};

export default nextConfig;
