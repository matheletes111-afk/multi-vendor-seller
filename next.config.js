/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'images.unsplash.com'],
  },
  serverExternalPackages: ["xlsx"],
  env: {
    MAP_KEY: process.env.MAP_KEY,
  },
}

module.exports = nextConfig

