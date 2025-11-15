const KNOWN_RECIPE_DOMAINS = [
  'allrecipes.com',
  'bbcgoodfood.com',
  'bonappetit.com',
  'cooking.nytimes.com',
  'delish.com',
  'epicurious.com',
  'food.com',
  'foodnetwork.com',
  'jamieoliver.com',
  'seriouseats.com',
  'simplyrecipes.com',
  'sallysbakingaddiction.com',
  'tasteofhome.com',
  'thekitchn.com',
  'pinchofyum.com',
  'bettycrocker.com',
  'tasty.co',
  'loveandlemons.com',
  'chefsavvy.com',
  'recipetineats.com',
  'skinnytaste.com',
  'minimalistbaker.com',
  'cookieandkate.com',
];

const RECIPE_PATH_KEYWORDS = ['recipe', 'recipes', 'cook', 'bake', 'meal', 'dish'];

/**
 * Light-weight heuristic to decide if a URL likely points to a recipe page.
 * Keeps the check cheap so we can call it frequently from clipboard polling.
 */
export function isProbablyRecipeUrl(text) {
  if (!text || typeof text !== 'string') return false;

  const trimmed = text.trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (KNOWN_RECIPE_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`))) {
      return true;
    }

    // Fallback: look for common recipe keywords in the pathname.
    const path = url.pathname.toLowerCase();
    return RECIPE_PATH_KEYWORDS.some(keyword => path.includes(keyword));
  } catch (_) {
    return false;
  }
}
