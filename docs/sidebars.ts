import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: '🚀 Getting Started',
      items: [
        'getting-started/quick-start',
        'getting-started/account-setup',
      ],
    },
    {
      type: 'category',
      label: '✂️ AI Clipping',
      items: [
        'ai-clipping/overview',
        'ai-clipping/uploading-videos',
        'ai-clipping/prompt-types',
        'ai-clipping/clip-settings',
        'ai-clipping/text-overlays',
        'ai-clipping/captions',
      ],
    },
    {
      type: 'category',
      label: '📚 Clip Library',
      items: [
        'clip-library/managing-clips',
        'clip-library/folders-and-tags',
        'clip-library/editing-clips',
        'clip-library/sharing-clips',
      ],
    },
    {
      type: 'category',
      label: '🎬 UGC Studio',
      items: [
        'ugc-studio/overview',
        {
          type: 'category',
          label: '👤 Characters',
          items: [
            'ugc-studio/characters/creating-characters',
            'ugc-studio/characters/managing-characters',
          ],
        },
        {
          type: 'category',
          label: '🔄 Face Swap',
          items: [
            'ugc-studio/face-swap/overview',
            'ugc-studio/face-swap/manual-segments',
            'ugc-studio/face-swap/auto-detect',
          ],
        },
        {
          type: 'category',
          label: '🎥 AI Video Creator',
          items: [
            'ugc-studio/ai-video-creator/overview',
            'ugc-studio/ai-video-creator/product-setup',
            'ugc-studio/ai-video-creator/script-generation',
            'ugc-studio/ai-video-creator/video-generation',
          ],
        },
        {
          type: 'category',
          label: '📋 Ad Clone',
          items: [
            'ugc-studio/ad-clone/overview',
            'ugc-studio/ad-clone/video-analysis',
            'ugc-studio/ad-clone/generating-clone',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '👥 Team Features',
      items: [
        'team-features/creating-teams',
        'team-features/inviting-members',
        'team-features/roles-permissions',
      ],
    },
    {
      type: 'category',
      label: '💳 Billing',
      items: [
        'billing/plans',
        'billing/credits-usage',
        'billing/referrals',
      ],
    },
  ],
};

export default sidebars;
