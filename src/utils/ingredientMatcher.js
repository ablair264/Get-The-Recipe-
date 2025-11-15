import { cleanIngredientForSearch } from './ingredientPriceService';

// Calculate string similarity using Levenshtein distance
const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  
  const a = str1.toLowerCase();
  const b = str2.toLowerCase();
  
  if (a === b) return 1;
  
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Calculate distances
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const maxLength = Math.max(a.length, b.length);
  return (maxLength - matrix[b.length][a.length]) / maxLength;
};

// Handle plural/singular variations
const normalizePlural = (word) => {
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  } else if (word.endsWith('es') && word.length > 3) {
    // Handle cases like "tomatoes" -> "tomato"
    if (word.endsWith('oes')) {
      return word.slice(0, -2);
    }
    return word.slice(0, -2);
  } else if (word.endsWith('s') && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
};

// Common ingredient synonyms
const INGREDIENT_SYNONYMS = {
  'scallions': ['green onions', 'spring onions'],
  'green onions': ['scallions', 'spring onions'],
  'spring onions': ['scallions', 'green onions'],
  'cilantro': ['coriander', 'fresh coriander'],
  'coriander': ['cilantro', 'fresh cilantro'],
  'bell pepper': ['pepper', 'capsicum'],
  'capsicum': ['bell pepper', 'pepper'],
  'zucchini': ['courgette'],
  'courgette': ['zucchini'],
  'eggplant': ['aubergine'],
  'aubergine': ['eggplant'],
  'arugula': ['rocket'],
  'rocket': ['arugula'],
  'heavy cream': ['double cream', 'whipping cream'],
  'double cream': ['heavy cream', 'whipping cream'],
  'confectioners sugar': ['powdered sugar', 'icing sugar'],
  'powdered sugar': ['confectioners sugar', 'icing sugar'],
  'icing sugar': ['confectioners sugar', 'powdered sugar'],
  'ground beef': ['mince', 'beef mince'],
  'mince': ['ground beef', 'beef mince'],
  'shrimp': ['prawns'],
  'prawns': ['shrimp']
};

// Enhanced fuzzy matching with synonym support
export const findBestIngredientMatch = (recipeIngredient, pantryItems, threshold = 0.6) => {
  if (!recipeIngredient || !pantryItems || pantryItems.length === 0) {
    return null;
  }
  
  const cleanedRecipe = cleanIngredientForSearch(recipeIngredient);
  const normalizedRecipe = normalizePlural(cleanedRecipe);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const pantryItem of pantryItems) {
    const cleanedPantry = pantryItem.cleaned_name || cleanIngredientForSearch(pantryItem.ingredient_name);
    const normalizedPantry = normalizePlural(cleanedPantry);
    
    // 1. Exact match (highest priority)
    if (cleanedRecipe === cleanedPantry) {
      return { item: pantryItem, score: 1.0, matchType: 'exact' };
    }
    
    // 2. Normalized match (handle plurals)
    if (normalizedRecipe === normalizedPantry) {
      return { item: pantryItem, score: 0.95, matchType: 'normalized' };
    }
    
    // 3. Substring match
    if (cleanedRecipe.includes(cleanedPantry) || cleanedPantry.includes(cleanedRecipe)) {
      const score = 0.9;
      if (score > bestScore) {
        bestMatch = { item: pantryItem, score, matchType: 'substring' };
        bestScore = score;
      }
    }
    
    // 4. Synonym match
    const recipeSynonyms = INGREDIENT_SYNONYMS[normalizedRecipe] || [];
    const pantrySynonyms = INGREDIENT_SYNONYMS[normalizedPantry] || [];
    
    if (recipeSynonyms.includes(normalizedPantry) || pantrySynonyms.includes(normalizedRecipe)) {
      const score = 0.85;
      if (score > bestScore) {
        bestMatch = { item: pantryItem, score, matchType: 'synonym' };
        bestScore = score;
      }
    }
    
    // 5. Fuzzy similarity match
    const similarity = calculateSimilarity(normalizedRecipe, normalizedPantry);
    if (similarity >= threshold && similarity > bestScore) {
      bestMatch = { item: pantryItem, score: similarity, matchType: 'fuzzy' };
      bestScore = similarity;
    }
    
    // 6. Word-based partial matching
    const recipeWords = normalizedRecipe.split(' ');
    const pantryWords = normalizedPantry.split(' ');
    
    const commonWords = recipeWords.filter(word => pantryWords.includes(word));
    if (commonWords.length > 0) {
      const wordScore = commonWords.length / Math.max(recipeWords.length, pantryWords.length);
      if (wordScore >= threshold && wordScore > bestScore) {
        bestMatch = { item: pantryItem, score: wordScore, matchType: 'partial' };
        bestScore = wordScore;
      }
    }
  }
  
  return bestMatch;
};

// Batch matching for multiple recipe ingredients
export const matchRecipeIngredientsToPantry = (recipeIngredients, pantryItems) => {
  if (!recipeIngredients || !pantryItems) {
    return [];
  }
  
  return recipeIngredients.map(ingredient => {
    const ingredientText = ingredient.ingredient_text || ingredient.cleaned_ingredient || ingredient;
    const match = findBestIngredientMatch(ingredientText, pantryItems);
    
    return {
      ingredient: ingredient,
      ingredientText,
      cleanedIngredient: cleanIngredientForSearch(ingredientText),
      pantryMatch: match?.item || null,
      matchScore: match?.score || 0,
      matchType: match?.matchType || 'none',
      inPantry: !!match && match.score >= 0.6
    };
  });
};

// Helper function to get ingredient suggestions for missing items
export const getSuggestedIngredients = (missingIngredient, allKnownIngredients, limit = 5) => {
  if (!missingIngredient || !allKnownIngredients) {
    return [];
  }
  
  const cleaned = cleanIngredientForSearch(missingIngredient);
  const suggestions = [];
  
  for (const knownIngredient of allKnownIngredients) {
    const similarity = calculateSimilarity(cleaned, knownIngredient);
    if (similarity > 0.3) {
      suggestions.push({
        ingredient: knownIngredient,
        similarity
      });
    }
  }
  
  return suggestions
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(s => s.ingredient);
};

export { calculateSimilarity, normalizePlural, INGREDIENT_SYNONYMS };