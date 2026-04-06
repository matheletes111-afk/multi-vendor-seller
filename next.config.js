/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'images.unsplash.com'],
  },
  serverExternalPackages: ["xlsx"],
}

module.exports = nextConfig

