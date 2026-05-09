/** @type {import('next').NextConfig} */
const nextConfig = {
  // 개발 환경에서만 같은 Wi-Fi 네트워크의 모바일 기기에서 접근 허용 (프로덕션 빌드 시 무시)
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['172.30.1.45', '172.30.1.*'],
  }),

  // Prisma 엔진 바이너리를 Vercel 배포 번들에 포함
  // custom output(src/generated/prisma) 사용 시 Next.js가 자동 추적하지 못하므로 명시 필요
  outputFileTracingIncludes: {
    '/**': ['./src/generated/prisma/**/*'],
  },

  experimental: {
    // Next.js 14: Prisma Client를 번들링하지 않고 외부 패키지로 처리
    // (serverExternalPackages는 Next.js 15+ 문법 — 14에서는 여기에 설정)
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },

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
