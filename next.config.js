/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'images.unsplash.com', 'm.media-amazon.com', 'www.shutterstock.com', 'media.istockphoto.com'],
  },
  serverExternalPackages: ["xlsx"],
  async headers() {
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://js.stripe.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' blob: data: https://images.unsplash.com https://meeemsl-bucket.s3.us-east-1.amazonaws.com https://*.googleapis.com https://*.gstatic.com https://*.media-amazon.com https://*.shutterstock.com https://*.istockphoto.com;
      font-src 'self' data: https://fonts.gstatic.com;
      connect-src 'self' https://maps.googleapis.com https://api.stripe.com https://*.googleapis.com;
      frame-src 'self' https://js.stripe.com;
      frame-ancestors 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

