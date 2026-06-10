export interface MediaImage {
  url: string;
  alternativeText?: string;
  width?: number;
  height?: number;
  formats?: {
    thumbnail?: MediaImageFormat;
    small?: MediaImageFormat;
    medium?: MediaImageFormat;
    large?: MediaImageFormat;
  };
}

export interface MediaImageFormat {
  url: string;
  width: number;
  height: number;
}

// Content types
export interface GlobalSettings {
  siteName: string;
  phone: string;
  email: string;
  address: string;
  vkUrl: string;
  telegramUrl: string;
  whatsappNumber: string;
  logo: MediaImage;
  defaultOgImage: MediaImage;
  footerText: string;
  yandexMetrikaId: string;
}

export interface SeoComponent {
  metaTitle: string;
  metaDescription: string;
  ogImage?: MediaImage;
}

export interface Leader {
  fullName: string;
  title: string;
  photo?: MediaImage;
  bio: string;
}

export interface AboutPage {
  title: string;
  heroImage?: MediaImage;
  historyContent: string;
  nikoAffiliation: string;
  leadershipTitle: string;
  leaders: Leader[];
  seo?: SeoComponent;
}

export interface TeamBuilding {
  title: string;
  subtitle: string;
  heroImage?: MediaImage;
  content: string;
  gallery: MediaImage[];
  ctaText: string;
  ctaPhone: string;
  seo?: SeoComponent;
}

export interface Event {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: MediaImage;
  gallery: MediaImage[];
  eventDate: string;
  eventType: 'news' | 'competition' | 'event' | 'exam' | 'other';
  isFeatured: boolean;
  seo?: SeoComponent;
}

export interface Coach {
  id: number;
  fullName: string;
  slug: string;
  photo?: MediaImage;
  rank: string;
  title: string;
  bio: string;
  achievements: string;
  sortOrder: number;
  gyms?: Gym[];
}

export interface Gym {
  id: number;
  name: string;
  slug: string;
  address: string;
  phone: string;
  description: string;
  photo?: MediaImage;
  yandexMapEmbed: string;
  latitude: number | null;
  longitude: number | null;
  sortOrder: number;
  coaches?: Coach[];
  scheduleEntries?: ScheduleEntry[];
}

export interface ScheduleEntry {
  id: number;
  dayOfWeek: string;
  timeStart: string;
  timeEnd: string;
  groupName: string;
  ageRange: string;
  coach?: Coach;
  gym?: Gym;
}

export interface RequirementRow {
  technique: string;
  repetitions: string;
  notes: string;
}

export interface BeltLevel {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  beltColor: string;
  colorHex: string;
  description: string;
  strengthTests: RequirementRow[];
  kihon: RequirementRow[];
  idoKihon: RequirementRow[];
  kata: RequirementRow[];
  kumite: RequirementRow[];
  sabaki: RequirementRow[];
  tameshiWari: RequirementRow[];
}

export interface KataVideo {
  id: number;
  title: string;
  vkVideoUrl: string;
  description: string;
  sortOrder: number;
  beltLevel?: BeltLevel;
}

export interface ContactSubmission {
  name: string;
  phone: string;
  email: string;
  childAge: string;
  preferredGym: string;
  message: string;
  formType: 'enrollment' | 'contact' | 'team-building';
}
