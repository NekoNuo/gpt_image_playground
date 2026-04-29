const apiProxyTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/+$/, '')

const rewrites = apiProxyTarget
  ? [
      {
        source: '/api-proxy/__capabilities',
        destination: '/api-proxy-capabilities.json',
      },
      {
        source: '/api-proxy/:path((?:v1/)?(?:images/generations|images/edits|responses))',
        destination: `${apiProxyTarget}/:path`,
      },
    ]
  : []

export const config = {
  git: {
    deploymentEnabled: false,
  },
  headers: apiProxyTarget
    ? [
        {
          source: '/api-proxy/__capabilities',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-store',
            },
          ],
        },
      ]
    : [],
  rewrites,
}
