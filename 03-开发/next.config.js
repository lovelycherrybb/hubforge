/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // 允许跨域 iframe 嵌入（同域部署时需要）
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
