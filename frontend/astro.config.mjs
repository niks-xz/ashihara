// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ashihara23.ru',
  output: 'static',
  redirects: {
    '/kids': '/',
    '/about': '/',
    '/faq': '/',
    '/contacts': '/gyms',
    '/schedule': '/gyms',
    '/calendar': '/events',
    '/student-path': '/education',
    '/methodology': '/education',
    '/methodology/[slug]': '/education/[slug]',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [sitemap()],
});
