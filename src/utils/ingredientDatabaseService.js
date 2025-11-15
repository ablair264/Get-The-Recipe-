import { cleanIngredientForSearch } from './ingredientPriceService';
import { calculateSimilarity, INGREDIENT_SYNONYMS } from './ingredientMatcher';

/**
 * Find or create a canonical ingredient in the database
 * @param {string} ingredientText - Raw ingredient text
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} Ingredient object with id
 */
export const findOrCreateIngredient = async (ingredientText, supabaseClient) => {
  try {
    const cleanedName = cleanIngredientForSearch(ingredientText);
    
    if (!cleanedName) {
      throw new Error('Invalid ingredient text');
    }

    // First, try to find exact match in ingredients table
    const { data: exactMatch, error: exactError } = await supabaseClient
      .from('ingredients')
      .select('*')
      .eq('name', cleanedName)
      .single();

    if (exactMatch && !exactError) {
      return exactMatch;
    }

    // Look for matches in aliases
    const { data: aliasMatch, error: aliasError } = await supabaseClient
      .from('ingredient_aliases')
      .select('ingredient_id, ingredients(*)')
      .eq('alias', cleanedName)
      .single();

    if (aliasMatch && !aliasError) {
      return aliasMatch.ingredients;
    }

    // Try fuzzy matching against existing ingredients
    const { data: allIngredients, error: allError } = await supabaseClient
      .from('ingredients')
      .select('*');

    if (allError) {
      throw allError;
    }

    // Find best fuzzy match
    let bestMatch = null;
    let bestScore = 0;
    const threshold = 0.8; // High threshold for auto-matching

    for (const ingredient of allIngredients || []) {
      const similarity = calculateSimilarity(cleanedName, ingredient.name);
      if (similarity > threshold && similarity > bestScore) {
        bestMatch = ingredient;
        bestScore = similarity;
      }
    }

    if (bestMatch) {
      // Create an alias for this variation
      await createIngredientAlias(bestMatch.id, cleanedName, supabaseClient);
      return bestMatch;
    }

    // Check for known synonyms
    for (const [canonical, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
      if (synonyms.includes(cleanedName)) {
        // Find the canonical ingredient
        const { data: canonicalIngredient } = await supabaseClient
          .from('ingredients')
          .select('*')
          .eq('name', canonical)
          .single();

        if (canonicalIngredient) {
          await createIngredientAlias(canonicalIngredient.id, cleanedName, supabaseClient);
          return canonicalIngredient;
        }
      }
    }

    // Create new ingredient if no match found
    const { data: newIngredient, error: createError } = await supabaseClient
      .from('ingredients')
      .insert({
        name: cleanedName,
        category: inferIngredientCategory(cleanedName),
        parent_name: null
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return newIngredient;

  } catch (error) {
    console.error('Error finding/creating ingredient:', error);
    throw error;
  }
};

/**
 * Create an alias for an ingredient
 * @param {string} ingredientId - Canonical ingredient ID
 * @param {string} alias - Alias text
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} Created alias
 */
export const createIngredientAlias = async (ingredientId, alias, supabaseClient) => {
  try {
    const { data, error } = await supabaseClient
      .from('ingredient_aliases')
      .upsert({
        ingredient_id: ingredientId,
        alias: alias.toLowerCase().trim(),
        priority: 0
      }, {
        onConflict: 'alias'
      })
      .select()
      .single();

    if (error) {
      console.warn('Error creating alias:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.warn('createIngredientAlias error:', error);
    return null;
  }
};

/**
 * Update pantry item to use ingredient_id system
 * @param {string} pantryItemId - Pantry item ID
 * @param {string} ingredientText - Raw ingredient text
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} Updated pantry item
 */
export const updatePantryItemWithIngredientId = async (pantryItemId, ingredientText, supabaseClient) => {
  try {
    // Find or create the canonical ingredient
    const ingredient = await findOrCreateIngredient(ingredientText, supabaseClient);

    // Update the pantry item
    const { data, error } = await supabaseClient
      .from('pantry_items')
      .update({
        ingredient_id: ingredient.id,
        cleaned_name: ingredient.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', pantryItemId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error updating pantry item with ingredient_id:', error);
    throw error;
  }
};

/**
 * Update recipe ingredient to use ingredient_id system
 * @param {string} recipeIngredientId - Recipe ingredient ID
 * @param {string} ingredientText - Raw ingredient text
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} Updated recipe ingredient
 */
export const updateRecipeIngredientWithIngredientId = async (recipeIngredientId, ingredientText, supabaseClient) => {
  try {
    // Find or create the canonical ingredient
    const ingredient = await findOrCreateIngredient(ingredientText, supabaseClient);

    // Update the recipe ingredient
    const { data, error } = await supabaseClient
      .from('recipe_ingredients')
      .update({
        ingredient_id: ingredient.id,
        cleaned_ingredient: ingredient.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', recipeIngredientId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error updating recipe ingredient with ingredient_id:', error);
    throw error;
  }
};

/**
 * Enhanced pantry matching using ingredient_id system
 * @param {string} recipeId - Recipe ID
 * @param {string} userId - User ID
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} Recipe details with improved pantry status
 */
export const getRecipeWithIngredientIdMatching = async (recipeId, userId, supabaseClient) => {
  try {
    // Get recipe ingredients with ingredient details
    const { data: ingredients, error: ingredientsError } = await supabaseClient
      .from('recipe_ingredients')
      .select(`
        *,
        ingredients (
          id,
          name,
          category,
          parent_name
        )
      `)
      .eq('recipe_id', recipeId)
      .order('position');

    if (ingredientsError) {
      throw ingredientsError;
    }

    // Get user's pantry items with ingredient details
    const { data: pantryItems, error: pantryError } = await supabaseClient
      .from('pantry_items')
      .select(`
        *,
        ingredients (
          id,
          name,
          category,
          parent_name
        )
      `)
      .eq('user_id', userId);

    if (pantryError) {
      throw pantryError;
    }

    // Create a map of ingredient_id to pantry items
    const pantryIngredientMap = new Map();
    pantryItems?.forEach(item => {
      if (item.ingredient_id && item.ingredients) {
        pantryIngredientMap.set(item.ingredient_id, item);
      }
    });

    // Match ingredients using ingredient_id system
    const ingredientsWithStatus = ingredients.map(ingredient => {
      let inPantry = false;
      let pantryMatch = null;
      let matchType = 'none';

      if (ingredient.ingredient_id && pantryIngredientMap.has(ingredient.ingredient_id)) {
        // Direct ingredient_id match (best case)
        inPantry = true;
        pantryMatch = pantryIngredientMap.get(ingredient.ingredient_id);
        matchType = 'ingredient_id';
      } else if (ingredient.ingredients?.parent_name) {
        // Check if parent ingredient is in pantry
        for (const [pantryIngredientId, pantryItem] of pantryIngredientMap) {
          if (pantryItem.ingredients?.name === ingredient.ingredients.parent_name) {
            inPantry = true;
            pantryMatch = pantryItem;
            matchType = 'parent_ingredient';
            break;
          }
        }
      }

      return {
        ...ingredient,
        in_pantry: inPantry,
        missing: !inPantry,
        pantry_match: pantryMatch,
        match_type: matchType,
        canonical_ingredient: ingredient.ingredients
      };
    });

    const totalIngredients = ingredients.length;
    const availableIngredients = ingredientsWithStatus.filter(ing => ing.in_pantry).length;
    const missingIngredients = ingredientsWithStatus.filter(ing => ing.missing);

    return {
      recipe_id: recipeId,
      ingredients: ingredientsWithStatus,
      total_ingredients: totalIngredients,
      available_ingredients: availableIngredients,
      missing_ingredients: missingIngredients,
      match_percentage: totalIngredients > 0 ? (availableIngredients / totalIngredients) * 100 : 0,
      matching_details: {
        ingredient_id_matches: ingredientsWithStatus.filter(m => m.match_type === 'ingredient_id').length,
        parent_ingredient_matches: ingredientsWithStatus.filter(m => m.match_type === 'parent_ingredient').length,
        no_matches: ingredientsWithStatus.filter(m => m.match_type === 'none').length
      }
    };

  } catch (error) {
    console.error('getRecipeWithIngredientIdMatching error:', error);
    throw error;
  }
};

/**
 * Infer ingredient category from name
 * @param {string} ingredientName - Ingredient name
 * @returns {string} Inferred category
 */
const inferIngredientCategory = (ingredientName) => {
  const categoryMap = {
    'dairy': ['milk', 'cheese', 'butter', 'cream', 'yogurt'],
    'meat': ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon'],
    'seafood': ['fish', 'salmon', 'tuna', 'shrimp', 'crab'],
    'vegetables': ['tomato', 'onion', 'garlic', 'carrot', 'pepper', 'lettuce'],
    'fruits': ['apple', 'banana', 'orange', 'lemon', 'lime'],
    'grains': ['rice', 'pasta', 'bread', 'flour', 'oats'],
    'spices': ['salt', 'pepper', 'basil', 'oregano', 'thyme'],
    'oils': ['oil', 'vinegar'],
    'pantry': ['sugar', 'vanilla', 'baking']
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(keyword => ingredientName.includes(keyword))) {
      return category;
    }
  }

  return 'other';
};

/**
 * Migrate existing pantry items to use ingredient_id system
 * @param {string} userId - User ID
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} Migration results
 */
export const migratePantryToIngredientIds = async (userId, supabaseClient) => {
  try {
    // Get all pantry items without ingredient_id
    const { data: pantryItems, error: pantryError } = await supabaseClient
      .from('pantry_items')
      .select('*')
      .eq('user_id', userId)
      .is('ingredient_id', null);

    if (pantryError) {
      throw pantryError;
    }

    let migrated = 0;
    let failed = 0;

    for (const item of pantryItems || []) {
      try {
        await updatePantryItemWithIngredientId(item.id, item.ingredient_name, supabaseClient);
        migrated++;
      } catch (error) {
        console.warn(`Failed to migrate pantry item ${item.id}:`, error);
        failed++;
      }
    }

    return {
      total: pantryItems?.length || 0,
      migrated,
      failed
    };

  } catch (error) {
    console.error('migratePantryToIngredientIds error:', error);
    throw error;
  }
};

export { inferIngredientCategory };