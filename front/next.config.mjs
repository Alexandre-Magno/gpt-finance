/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const isDocker = process.env.DOCKER_ENV === 'true';

    // Em producao o compose injeta BACKEND_URL apontando para o servico
    // interno (http://backend:8000). Os fallbacks cobrem dev local.
    const backendUrl =
      process.env.BACKEND_URL ||
      (isDocker ? 'http://backend:8000' : 'http://127.0.0.1:8000');

    return [
      {
        source: '/api/llm/:path*',
        destination: `${backendUrl}/llm/:path*`,
      },
      {
        source: '/api/agent',
        destination: `${backendUrl}/agent`,
      },
      {
        source: '/api/search',
        destination: `${backendUrl}/search`,
      },
    ];
  },

  httpAgentOptions: {
    keepAlive: true,
  },

  experimental: {
    proxyTimeout: 120_000, // 120 seconds
  },
};

export default nextConfig;