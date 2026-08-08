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

  // O uvicorn fecha conexao ociosa em 5s (timeout_keep_alive padrao) e o
  // Node guarda o socket no pool por bem mais tempo: a request seguinte
  // reaproveitava um socket ja morto e virava ECONNRESET ("socket hang up"),
  // um 500 em menos de 1s logo apos uma analise longa. Sem controle sobre o
  // freeSocketTimeout do agent, desligar keep-alive e o que elimina a corrida
  // -- o handshake TCP na rede interna do compose e irrelevante perto dos
  // ~80s de uma analise.
  httpAgentOptions: {
    keepAlive: false,
  },

  experimental: {
    // Uma analise completa sao 4 chamadas ao LLM em sequencia e leva ~80-100s;
    // com fallback de modelo passa disso. 120s cortava respostas validas.
    proxyTimeout: 300_000, // 5 minutos
  },
};

export default nextConfig;