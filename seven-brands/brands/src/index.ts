import { BrandConfig, type BrandSlug, type BrandStatus } from "@sb/core";

/**
 * Code-level defaults for the seven brands. Each brand has its own identity:
 * palette, typography, layout family and motion personality. The DB seed copies
 * these into the `brand` table; admins can then edit the patchable fields.
 *
 * Fonts referenced here are open-licensed (SIL OFL) families available on Google Fonts.
 */

export interface BrandDefinition {
  config: BrandConfig;
  initialStatus: BrandStatus;
  /** Roadmap phase in which the storefront is built (see DEVELOPMENT_ROADMAP.md). */
  launchPhase: number;
}

const ALL_LICENSES = ["personal", "commercial", "team", "agency", "enterprise"] as const;

const defs: Record<BrandSlug, BrandDefinition> = {
  moodicons: {
    initialStatus: "in_development",
    launchPhase: 4,
    config: {
      slug: "moodicons",
      name: "Moodicons",
      tagline: "Feelings, animated.",
      description:
        "Expressive animated icons and stickers for emotions, reactions and everyday moments.",
      category: "Emotional and expressive animated icons",
      domains: ["moodicons.localhost"],
      defaultCurrency: "USD",
      layout: "playful-grid",
      theme: {
        tokens: {
          background: "#FFF8EC",
          surface: "#FFFFFF",
          text: "#2B1B12",
          mutedText: "#6B5547",
          primary: "#C81E5B",
          primaryText: "#FFFFFF",
          accent: "#FFC83D",
          border: "#F1DFC9",
        },
        fonts: { heading: '"Baloo 2", system-ui, sans-serif', body: "Nunito, system-ui, sans-serif" },
        radius: "full",
        motionPersonality: "bouncy",
      },
      catalog: {
        categories: [
          { slug: "happiness", label: "Happiness" },
          { slug: "love", label: "Love" },
          { slug: "sadness", label: "Sadness" },
          { slug: "anger", label: "Anger" },
          { slug: "surprise", label: "Surprise" },
          { slug: "celebration", label: "Celebration" },
          { slug: "friendship", label: "Friendship" },
          { slug: "reactions", label: "Social reactions" },
          { slug: "everyday", label: "Everyday expressions" },
          { slug: "characters", label: "Cute characters" },
          { slug: "stickers", label: "Animated stickers" },
          { slug: "seasonal", label: "Seasonal" },
          { slug: "bawal", label: "Bawal signs (PH)" },
        ],
      },
      audiences: ["Consumers", "Social media creators", "Designers", "Developers", "Digital marketers"],
      marketingChannels: ["TikTok", "Instagram", "Pinterest", "Creator communities", "Design communities"],
      licenseTypes: ["personal", "commercial", "team", "agency"],
      features: { soundPreview: true, customizer: true, developerExports: true, childSafeMode: false },
    },
  },
  sonicglyphs: {
    initialStatus: "in_development",
    launchPhase: 4,
    config: {
      slug: "sonicglyphs",
      name: "SonicGlyphs",
      tagline: "Icons you can hear.",
      description: "Audio-reactive animated icons with motion and sound designed together.",
      category: "Audio-reactive animated icons",
      domains: ["sonicglyphs.localhost"],
      defaultCurrency: "USD",
      layout: "studio-dark",
      theme: {
        tokens: {
          background: "#0B0B14",
          surface: "#161626",
          text: "#F2F2FA",
          mutedText: "#A3A3C2",
          primary: "#7CF0C5",
          primaryText: "#0B0B14",
          accent: "#8A5CFF",
          border: "#2A2A44",
        },
        fonts: { heading: '"Space Grotesk", system-ui, sans-serif', body: "Inter, system-ui, sans-serif" },
        radius: "md",
        motionPersonality: "snappy",
      },
      catalog: {
        categories: [
          { slug: "instruments", label: "Musical instruments" },
          { slug: "audio-gear", label: "Audio equipment" },
          { slug: "notes", label: "Music notes" },
          { slug: "recording", label: "Recording" },
          { slug: "notifications", label: "Notification sounds" },
          { slug: "visualizers", label: "Sound visualization" },
          { slug: "reactive", label: "Audio-reactive effects" },
          { slug: "gaming", label: "Gaming sounds" },
        ],
      },
      audiences: ["Musicians", "Content creators", "Audio professionals", "Designers", "Developers", "Game studios"],
      marketingChannels: ["YouTube", "Music creators", "Audio communities", "Developer communities"],
      licenseTypes: [...ALL_LICENSES],
      features: { soundPreview: true, customizer: true, developerExports: true, childSafeMode: false },
    },
  },
  learnicons: {
    initialStatus: "planned",
    launchPhase: 6,
    config: {
      slug: "learnicons",
      name: "LearnIcons",
      tagline: "Learning that moves and speaks.",
      description: "Interactive educational icons for parents, teachers and schools.",
      category: "Educational interactive icons",
      domains: ["learnicons.localhost"],
      defaultCurrency: "USD",
      layout: "classroom",
      theme: {
        tokens: {
          background: "#F4FBFF",
          surface: "#FFFFFF",
          text: "#13324B",
          mutedText: "#4A6478",
          primary: "#1565C0",
          primaryText: "#FFFFFF",
          accent: "#FFB300",
          border: "#CFE6F5",
        },
        fonts: {
          heading: "Fredoka, system-ui, sans-serif",
          body: '"Atkinson Hyperlegible", system-ui, sans-serif',
        },
        radius: "lg",
        motionPersonality: "smooth",
      },
      catalog: {
        categories: [
          { slug: "alphabet", label: "Alphabet and phonics" },
          { slug: "numbers", label: "Numbers and maths" },
          { slug: "animals", label: "Animals and sounds" },
          { slug: "nature", label: "Nature" },
          { slug: "human-body", label: "Human body" },
          { slug: "transport", label: "Transportation" },
          { slug: "objects", label: "Everyday objects" },
          { slug: "science", label: "Science" },
          { slug: "technology", label: "Technology" },
          { slug: "languages", label: "Languages" },
        ],
      },
      audiences: ["Parents", "Teachers", "Schools", "Educational creators", "EdTech companies"],
      marketingChannels: ["Teacher communities", "Parent communities", "Educational content", "EdTech partnerships"],
      licenseTypes: ["personal", "commercial", "team", "enterprise"],
      features: { soundPreview: true, customizer: true, developerExports: true, childSafeMode: true },
    },
  },
  shopmotion: {
    initialStatus: "planned",
    launchPhase: 6,
    config: {
      slug: "shopmotion",
      name: "ShopMotion",
      tagline: "Storefront animations that convert.",
      description: "Animated icons and micro-interactions for ecommerce stores.",
      category: "Interactive ecommerce assets",
      domains: ["shopmotion.localhost"],
      defaultCurrency: "USD",
      layout: "merchant",
      theme: {
        tokens: {
          background: "#FFFFFF",
          surface: "#F5F7F6",
          text: "#0F1F17",
          mutedText: "#4B5E55",
          primary: "#0B7A4B",
          primaryText: "#FFFFFF",
          accent: "#FF6B35",
          border: "#DCE5E0",
        },
        fonts: { heading: "Manrope, system-ui, sans-serif", body: "Manrope, system-ui, sans-serif" },
        radius: "md",
        motionPersonality: "snappy",
      },
      catalog: {
        categories: [
          { slug: "cart", label: "Cart and wishlist" },
          { slug: "checkout", label: "Checkout and payment" },
          { slug: "shipping", label: "Shipping and delivery" },
          { slug: "tracking", label: "Package tracking" },
          { slug: "support", label: "Customer support" },
          { slug: "promotions", label: "Discounts and promotions" },
          { slug: "confirmation", label: "Purchase confirmation" },
        ],
      },
      audiences: ["Shopify merchants", "WooCommerce merchants", "Online retailers", "Ecommerce agencies"],
      marketingChannels: ["Shopify ecosystem", "Ecommerce communities", "Shopify agencies", "Ecommerce tutorials"],
      licenseTypes: [...ALL_LICENSES],
      features: { soundPreview: true, customizer: true, developerExports: true, childSafeMode: false },
    },
  },
  cineglyphs: {
    initialStatus: "planned",
    launchPhase: 5,
    config: {
      slug: "cineglyphs",
      name: "CineGlyphs",
      tagline: "Cinematic icons with sound.",
      description: "Animated icons and audiovisual effects for filmmakers and video editors.",
      category: "Cinematic animated icons and audiovisual effects",
      domains: ["cineglyphs.localhost"],
      defaultCurrency: "USD",
      layout: "cinema",
      theme: {
        tokens: {
          background: "#0A0A0A",
          surface: "#17140F",
          text: "#F5EBDD",
          mutedText: "#B3A48E",
          primary: "#E5B95C",
          primaryText: "#0A0A0A",
          accent: "#C0392B",
          border: "#2E281F",
        },
        fonts: { heading: '"Bebas Neue", Impact, sans-serif', body: "Inter, system-ui, sans-serif" },
        radius: "sm",
        motionPersonality: "cinematic",
      },
      catalog: {
        categories: [
          { slug: "camera", label: "Camera equipment" },
          { slug: "production", label: "Film production" },
          { slug: "editing", label: "Video editing" },
          { slug: "sound", label: "Sound production" },
          { slug: "transitions", label: "Cinematic transitions" },
          { slug: "effects", label: "Movie effects" },
          { slug: "streaming", label: "Streaming" },
          { slug: "creator-tools", label: "Creator tools" },
        ],
      },
      audiences: ["Filmmakers", "Video editors", "YouTubers", "Production studios", "Motion designers", "Ad agencies"],
      marketingChannels: ["YouTube", "Filmmaking communities", "Video editing communities", "Motion design communities"],
      licenseTypes: [...ALL_LICENSES],
      features: { soundPreview: true, customizer: true, developerExports: false, childSafeMode: false },
    },
  },
  atmosicons: {
    initialStatus: "planned",
    launchPhase: 5,
    config: {
      slug: "atmosicons",
      name: "AtmosIcons",
      tagline: "Weather, water and wild, alive.",
      description: "Environmental animated graphics paired with natural and ambient sound.",
      category: "Environmental and atmospheric animated assets",
      domains: ["atmosicons.localhost"],
      defaultCurrency: "USD",
      layout: "ambient",
      theme: {
        tokens: {
          background: "#EEF3F1",
          surface: "#FFFFFF",
          text: "#1C2B2A",
          mutedText: "#4F6261",
          primary: "#2F6F68",
          primaryText: "#FFFFFF",
          accent: "#8FB8DE",
          border: "#D3E0DD",
        },
        fonts: { heading: "Fraunces, Georgia, serif", body: "Inter, system-ui, sans-serif" },
        radius: "lg",
        motionPersonality: "calm",
      },
      catalog: {
        categories: [
          { slug: "weather", label: "Weather" },
          { slug: "ocean", label: "Ocean and water" },
          { slug: "fire", label: "Fire" },
          { slug: "forest", label: "Forest" },
          { slug: "wildlife", label: "Wildlife" },
          { slug: "seasons", label: "Seasons" },
          { slug: "phenomena", label: "Natural phenomena" },
          { slug: "ambient", label: "Ambient environments" },
        ],
      },
      audiences: ["Game developers", "Wellness platforms", "Meditation apps", "Designers", "Educators"],
      marketingChannels: ["Game dev communities", "Wellness communities", "Ambient content", "App developers"],
      licenseTypes: [...ALL_LICENSES],
      features: { soundPreview: true, customizer: true, developerExports: true, childSafeMode: false },
    },
  },
  aliveui: {
    initialStatus: "planned",
    launchPhase: 7,
    config: {
      slug: "aliveui",
      name: "AliveUI",
      tagline: "Interface components that move and respond.",
      description: "Animated, optionally audible UI components for React and Web Components.",
      category: "Interactive user-interface components",
      domains: ["aliveui.localhost"],
      defaultCurrency: "USD",
      layout: "docs",
      theme: {
        tokens: {
          background: "#FFFFFF",
          surface: "#F6F7F9",
          text: "#0D1117",
          mutedText: "#57606A",
          primary: "#4F46E5",
          primaryText: "#FFFFFF",
          accent: "#06B6D4",
          border: "#D0D7DE",
        },
        fonts: { heading: "Geist, system-ui, sans-serif", body: "Geist, system-ui, sans-serif" },
        radius: "md",
        motionPersonality: "precise",
      },
      catalog: {
        categories: [
          { slug: "buttons", label: "Buttons" },
          { slug: "toggles", label: "Toggles" },
          { slug: "notifications", label: "Notifications" },
          { slug: "loaders", label: "Loading indicators" },
          { slug: "menus", label: "Menus and navigation" },
          { slug: "forms", label: "Form interactions" },
          { slug: "states", label: "Success and error states" },
          { slug: "illustrations", label: "UI illustrations" },
        ],
      },
      audiences: ["Developers", "SaaS companies", "Software companies", "Web designers", "Agencies"],
      marketingChannels: ["GitHub", "Developer communities", "Technical tutorials", "Frontend content", "Docs"],
      licenseTypes: [...ALL_LICENSES],
      features: { soundPreview: true, customizer: true, developerExports: true, childSafeMode: false },
    },
  },
};

// Validate at module load: a broken default should fail fast in dev and CI.
for (const def of Object.values(defs)) BrandConfig.parse(def.config);

export const BRAND_DEFINITIONS: Readonly<Record<BrandSlug, BrandDefinition>> = defs;

export function getBrandDefinition(slug: BrandSlug): BrandDefinition {
  return defs[slug];
}
