import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Cuttr Docs',
  tagline: 'Create viral short-form content with AI',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.cuttr.ai',
  baseUrl: '/',

  organizationName: 'cuttr',
  projectName: 'cuttr-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/cuttr-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Cuttr',
      logo: {
        alt: 'Cuttr Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://app.cuttr.ai',
          label: 'Open App',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {
              label: 'Quick Start',
              to: '/getting-started/quick-start',
            },
            {
              label: 'AI Clipping',
              to: '/ai-clipping/overview',
            },
            {
              label: 'UGC Studio',
              to: '/ugc-studio/overview',
            },
          ],
        },
        {
          title: 'Product',
          items: [
            {
              label: 'Plans & Pricing',
              to: '/billing/plans',
            },
            {
              label: 'Open App',
              href: 'https://app.cuttr.ai',
            },
          ],
        },
        {
          title: 'Support',
          items: [
            {
              label: 'Email Support',
              href: 'mailto:support@cuttr.ai',
            },
            {
              label: 'Website',
              href: 'https://cuttr.ai',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Cuttr. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
