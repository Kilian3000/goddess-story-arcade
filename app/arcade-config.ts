const DEFAULT_CARD_DATABASE_URL = "/card-data/db.js";
const DEFAULT_CARD_IMAGE_ROOT = "/card-data/";

function configured(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  return candidate || fallback;
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

const brandLead = configured(process.env.NEXT_PUBLIC_ARCADE_BRAND_LEAD, "GODDESS");
const brandAccent = configured(process.env.NEXT_PUBLIC_ARCADE_BRAND_ACCENT, ".STORY");
const brandTagline = configured(process.env.NEXT_PUBLIC_ARCADE_TAGLINE, "CARD ARCADE");

export const arcadeConfig = Object.freeze({
  brandLead,
  brandAccent,
  brandTagline,
  brandLabel: `${brandLead}${brandAccent} ${brandTagline}`,
  siteTitle: configured(process.env.NEXT_PUBLIC_ARCADE_TITLE, "Goddess Story Arcade"),
  siteUrl: configured(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
  cardDatabaseUrl: configured(
    process.env.NEXT_PUBLIC_CARD_DATABASE_URL,
    DEFAULT_CARD_DATABASE_URL,
  ),
  cardImageRoot: withTrailingSlash(configured(
    process.env.NEXT_PUBLIC_CARD_IMAGE_ROOT,
    DEFAULT_CARD_IMAGE_ROOT,
  )),
});

export function cardAsset(path: string | null | undefined) {
  if (!path) return "";
  if (/^(?:https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${arcadeConfig.cardImageRoot}${path.replace(/^\/+/, "")}`;
}
