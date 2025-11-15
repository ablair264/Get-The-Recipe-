import AsyncStorage from '@react-native-async-storage/async-storage';

const cleanIngredientForSearch = (ingredient) => {
  if (!ingredient || typeof ingredient !== 'string') {
    return '';
  }

  let cleaned = ingredient.toLowerCase();

  // Remove quantities and measurements at the beginning (including fractions)
  cleaned = cleaned.replace(/^\d+(\s+\d+\/\d+|\.\d+|\s*\/\s*\d+)?\s*(x\s*\d+(\.\d+)?)?\s*(kg|g|lb|lbs|oz|ml|l|litres?|pints?|cups?|cup|tbsp|tsp|tablespoons?|teaspoons?|pieces?|cloves?|slices?)\s+/i, '');
  
  // Remove quantities in parentheses like (400g), (2 x 400g)
  cleaned = cleaned.replace(/\(\d+(\.\d+)?\s*(x\s*\d+(\.\d+)?)?\s*(kg|g|lb|lbs|oz|ml|l|litres?|pints?|cups?|cup|tbsp|tsp|pieces?)\)/gi, '');
  
  // Remove preparation notes in parentheses
  cleaned = cleaned.replace(/\([^)]*(?:chopped|diced|sliced|crushed|minced|grated|peeled|cored|halved|quartered|cubed|finely|roughly|fresh|dried|frozen|canned|tinned|ground|whole|large|small|medium)\)/gi, '');
  
  // Remove descriptors but preserve important nouns like "oil", "flour", "cheese"
  cleaned = cleaned.replace(/\b(chopped|diced|sliced|crushed|minced|grated|peeled|cored|halved|quartered|cubed|finely|roughly|fresh|dried|frozen|canned|tinned|ground|whole|large|small|medium|free-range|organic|granulated|powdered|sifted|lumpy|dark|sea)\b/gi, '');
  
  // Handle compound ingredients more carefully
  // For "extra virgin olive oil" -> keep "olive oil"
  if (cleaned.includes('extra virgin olive oil')) {
    cleaned = 'olive oil';
  } else if (cleaned.includes('all-purpose flour') || cleaned.includes('all purpose flour')) {
    cleaned = 'flour';
  } else if (cleaned.includes('olive oil')) {
    cleaned = cleaned.replace(/\b(extra|virgin)\b/gi, '').replace(/\s+/g, ' ').trim();
  }
  
  // Remove "if lumpy" and similar conditional phrases
  cleaned = cleaned.replace(/,?\s*if\s+\w+/gi, '');
  
  // Remove alternative ingredients (e.g., "canola oil or extra-virgin olive oil" -> "oil")
  cleaned = cleaned.replace(/\s+or\s+.*$/i, '');
  
  // Remove "plus extra for" type instructions
  cleaned = cleaned.replace(/,?\s*plus\s+(extra|more)\s+for.*$/i, '');
  
  // Remove "to taste" and similar
  cleaned = cleaned.replace(/,?\s*to\s+taste.*$/i, '');
  
  // Remove "Note X" references
  cleaned = cleaned.replace(/\(?note\s+\d+\)?/gi, '');
  
  // Remove any remaining parentheses and their contents
  cleaned = cleaned.replace(/\([^)]*\)/g, '');
  
  // Remove extra whitespace and punctuation
  cleaned = cleaned.replace(/[,;]+/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();
  
  // Smart core ingredient extraction
  const words = cleaned.split(' ');
  const stopWords = ['of', 'and', 'or', 'with', 'for', 'the', 'a', 'an'];
  const filteredWords = words.filter(word => !stopWords.includes(word) && word.length > 1);
  
  // Identify important food nouns that should be preserved
  const importantNouns = ['oil', 'flour', 'cheese', 'milk', 'cream', 'butter', 'sauce', 'powder', 'chips', 'beans', 'rice', 'pasta', 'bread', 'stock', 'broth', 'vinegar', 'sugar', 'salt', 'pepper', 'herbs', 'spices'];
  
  // Find the last important noun in the ingredient name
  let lastImportantNoun = '';
  for (let i = filteredWords.length - 1; i >= 0; i--) {
    if (importantNouns.includes(filteredWords[i])) {
      lastImportantNoun = filteredWords[i];
      break;
    }
  }
  
  // If we found an important noun, build the name around it
  if (lastImportantNoun) {
    const nounIndex = filteredWords.indexOf(lastImportantNoun);
    // Take the word before the noun (if exists) and the noun itself
    const startIndex = Math.max(0, nounIndex - 1);
    return filteredWords.slice(startIndex, nounIndex + 1).join(' ');
  }
  
  // Fallback: take first 2 meaningful words but be smarter about it
  if (filteredWords.length === 1) {
    return filteredWords[0];
  } else if (filteredWords.length >= 2) {
    // For compound ingredients, prefer the last 2 words which usually contain the main ingredient
    return filteredWords.slice(-2).join(' ');
  }
  
  return filteredWords.slice(0, 2).join(' ');
};

const searchProductPrices = async (ingredient) => {
  try {
    const cleanedIngredient = cleanIngredientForSearch(ingredient);
    if (!cleanedIngredient) return [];

    // Note: This is a placeholder implementation
    // In a real app, you would integrate with multiple grocery API services
    // For demo purposes, we'll return mock data from multiple supermarkets
    
    const mockPricesDatabase = {
      'chicken breast': [
        { price: '£7.00', shop: 'Tesco', per: 'kg', url: 'tesco.com' },
        { price: '£6.50', shop: 'ASDA', per: 'kg', url: 'asda.com' },
        { price: '£7.20', shop: 'Sainsburys', per: 'kg', url: 'sainsburys.co.uk' },
        { price: '£8.00', shop: 'Waitrose', per: 'kg', url: 'waitrose.com' }
      ],
      'tomatoes': [
        { price: '£2.50', shop: 'Tesco', per: 'kg', url: 'tesco.com' },
        { price: '£2.20', shop: 'ASDA', per: 'kg', url: 'asda.com' },
        { price: '£2.80', shop: 'Sainsburys', per: 'kg', url: 'sainsburys.co.uk' },
        { price: '£3.00', shop: 'Waitrose', per: 'kg', url: 'waitrose.com' }
      ],
      'onions': [
        { price: '£1.20', shop: 'Tesco', per: 'kg', url: 'tesco.com' },
        { price: '£1.00', shop: 'ASDA', per: 'kg', url: 'asda.com' },
        { price: '£1.40', shop: 'Sainsburys', per: 'kg', url: 'sainsburys.co.uk' },
        { price: '£1.60', shop: 'Waitrose', per: 'kg', url: 'waitrose.com' }
      ],
      'garlic': [
        { price: '£0.60', shop: 'Tesco', per: 'bulb', url: 'tesco.com' },
        { price: '£0.50', shop: 'ASDA', per: 'bulb', url: 'asda.com' },
        { price: '£0.70', shop: 'Sainsburys', per: 'bulb', url: 'sainsburys.co.uk' }
      ],
      'olive oil': [
        { price: '£4.50', shop: 'Tesco', per: '500ml', url: 'tesco.com' },
        { price: '£3.80', shop: 'ASDA', per: '500ml', url: 'asda.com' },
        { price: '£5.20', shop: 'Sainsburys', per: '500ml', url: 'sainsburys.co.uk' }
      ],
      'pasta': [
        { price: '£1.20', shop: 'Tesco', per: '500g', url: 'tesco.com' },
        { price: '£1.00', shop: 'ASDA', per: '500g', url: 'asda.com' },
        { price: '£1.40', shop: 'Sainsburys', per: '500g', url: 'sainsburys.co.uk' }
      ],
      'cheese': [
        { price: '£3.80', shop: 'Tesco', per: '250g', url: 'tesco.com' },
        { price: '£3.50', shop: 'ASDA', per: '250g', url: 'asda.com' },
        { price: '£4.20', shop: 'Sainsburys', per: '250g', url: 'sainsburys.co.uk' }
      ],
      'milk': [
        { price: '£1.45', shop: 'Tesco', per: '1L', url: 'tesco.com' },
        { price: '£1.35', shop: 'ASDA', per: '1L', url: 'asda.com' },
        { price: '£1.50', shop: 'Sainsburys', per: '1L', url: 'sainsburys.co.uk' }
      ],
      'eggs': [
        { price: '£2.20', shop: 'Tesco', per: '12 pack', url: 'tesco.com' },
        { price: '£2.00', shop: 'ASDA', per: '12 pack', url: 'asda.com' },
        { price: '£2.40', shop: 'Sainsburys', per: '12 pack', url: 'sainsburys.co.uk' }
      ],
      'bread': [
        { price: '£1.10', shop: 'Tesco', per: 'loaf', url: 'tesco.com' },
        { price: '£0.90', shop: 'ASDA', per: 'loaf', url: 'asda.com' },
        { price: '£1.30', shop: 'Sainsburys', per: 'loaf', url: 'sainsburys.co.uk' }
      ],
      'sugar': [
        { price: '£1.10', shop: 'Tesco', per: 'kg', url: 'tesco.com' },
        { price: '£0.95', shop: 'ASDA', per: 'kg', url: 'asda.com' },
        { price: '£1.25', shop: 'Sainsburys', per: 'kg', url: 'sainsburys.co.uk' },
        { price: '£1.40', shop: 'Waitrose', per: 'kg', url: 'waitrose.com' }
      ],
      'flour': [
        { price: '£1.30', shop: 'Tesco', per: '1.5kg', url: 'tesco.com' },
        { price: '£1.15', shop: 'ASDA', per: '1.5kg', url: 'asda.com' },
        { price: '£1.45', shop: 'Sainsburys', per: '1.5kg', url: 'sainsburys.co.uk' },
        { price: '£1.70', shop: 'Waitrose', per: '1.5kg', url: 'waitrose.com' }
      ],
      'cocoa powder': [
        { price: '£2.50', shop: 'Tesco', per: '250g', url: 'tesco.com' },
        { price: '£2.20', shop: 'ASDA', per: '250g', url: 'asda.com' },
        { price: '£2.80', shop: 'Sainsburys', per: '250g', url: 'sainsburys.co.uk' },
        { price: '£3.20', shop: 'Waitrose', per: '250g', url: 'waitrose.com' }
      ],
      'cocoa': [
        { price: '£2.50', shop: 'Tesco', per: '250g', url: 'tesco.com' },
        { price: '£2.20', shop: 'ASDA', per: '250g', url: 'asda.com' },
        { price: '£2.80', shop: 'Sainsburys', per: '250g', url: 'sainsburys.co.uk' }
      ],
      'chocolate chips': [
        { price: '£2.80', shop: 'Tesco', per: '200g', url: 'tesco.com' },
        { price: '£2.50', shop: 'ASDA', per: '200g', url: 'asda.com' },
        { price: '£3.20', shop: 'Sainsburys', per: '200g', url: 'sainsburys.co.uk' },
        { price: '£3.80', shop: 'Waitrose', per: '200g', url: 'waitrose.com' }
      ],
      'chocolate': [
        { price: '£2.80', shop: 'Tesco', per: '200g', url: 'tesco.com' },
        { price: '£2.50', shop: 'ASDA', per: '200g', url: 'asda.com' },
        { price: '£3.20', shop: 'Sainsburys', per: '200g', url: 'sainsburys.co.uk' }
      ],
      'salt': [
        { price: '£0.65', shop: 'Tesco', per: '750g', url: 'tesco.com' },
        { price: '£0.55', shop: 'ASDA', per: '750g', url: 'asda.com' },
        { price: '£0.80', shop: 'Sainsburys', per: '750g', url: 'sainsburys.co.uk' }
      ],
      'oil': [
        { price: '£2.80', shop: 'Tesco', per: '1L', url: 'tesco.com' },
        { price: '£2.50', shop: 'ASDA', per: '1L', url: 'asda.com' },
        { price: '£3.20', shop: 'Sainsburys', per: '1L', url: 'sainsburys.co.uk' },
        { price: '£3.80', shop: 'Waitrose', per: '1L', url: 'waitrose.com' }
      ],
      'water': [
        { price: '£0.45', shop: 'Tesco', per: '2L', url: 'tesco.com' },
        { price: '£0.35', shop: 'ASDA', per: '2L', url: 'asda.com' },
        { price: '£0.55', shop: 'Sainsburys', per: '2L', url: 'sainsburys.co.uk' }
      ],
      'vanilla': [
        { price: '£2.20', shop: 'Tesco', per: '38ml', url: 'tesco.com' },
        { price: '£1.90', shop: 'ASDA', per: '38ml', url: 'asda.com' },
        { price: '£2.50', shop: 'Sainsburys', per: '38ml', url: 'sainsburys.co.uk' },
        { price: '£3.00', shop: 'Waitrose', per: '38ml', url: 'waitrose.com' }
      ]
    };

    // Check if we have prices for this ingredient
    const exactMatch = mockPricesDatabase[cleanedIngredient];
    if (exactMatch) {
      return exactMatch.sort((a, b) => parseFloat(a.price.replace('£', '')) - parseFloat(b.price.replace('£', '')));
    }

    // Try partial matching
    for (const [key, prices] of Object.entries(mockPricesDatabase)) {
      if (key.includes(cleanedIngredient) || cleanedIngredient.includes(key)) {
        return prices.sort((a, b) => parseFloat(a.price.replace('£', '')) - parseFloat(b.price.replace('£', '')));
      }
    }

    return [];
  } catch (error) {
    console.warn('Error searching for ingredient prices:', error);
    return [];
  }
};

const CACHE_EXPIRY = 1000 * 60 * 60 * 24; // 24 hours
const CACHE_KEY_PREFIX = 'ingredient_price_';

const getCachedPrice = async (ingredient) => {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${cleanIngredientForSearch(ingredient)}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    
    if (cached) {
      const { price, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return price;
      }
    }
    return null;
  } catch (error) {
    console.warn('Error getting cached price:', error);
    return null;
  }
};

const setCachedPrice = async (ingredient, price) => {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${cleanIngredientForSearch(ingredient)}`;
    const cacheData = {
      price,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Error caching price:', error);
  }
};

export const getIngredientPrice = async (ingredient) => {
  try {
    // Check cache first
    const cachedPrices = await getCachedPrice(ingredient);
    if (cachedPrices) {
      return cachedPrices;
    }

    // Search for fresh prices from multiple supermarkets
    const prices = await searchProductPrices(ingredient);
    
    // Cache the result
    if (prices && prices.length > 0) {
      await setCachedPrice(ingredient, prices);
      return prices;
    }
    
    return [];
  } catch (error) {
    console.warn('Error getting ingredient price:', error);
    return [];
  }
};

export const getIngredientPrices = async (ingredients) => {
  try {
    const pricePromises = ingredients.map(async (ingredient) => {
      const prices = await getIngredientPrice(ingredient);
      return {
        ingredient,
        cleanedName: cleanIngredientForSearch(ingredient),
        prices: prices || [],
        bestPrice: prices && prices.length > 0 ? prices[0] : null // Already sorted by price
      };
    });

    return await Promise.all(pricePromises);
  } catch (error) {
    console.warn('Error getting ingredient prices:', error);
    return ingredients.map(ingredient => ({
      ingredient,
      cleanedName: cleanIngredientForSearch(ingredient),
      prices: [],
      bestPrice: null
    }));
  }
};

export { cleanIngredientForSearch };