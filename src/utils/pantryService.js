import { cleanIngredientForSearch } from './ingredientPriceService';
import { matchRecipeIngredientsToPantry } from './ingredientMatcher';

/**
 * Adds an item to the user's pantry
 * @param {string} ingredientName - The ingredient name
 * @param {string} quantity - Optional quantity
 * @param {string} notes - Optional notes
 * @param {string} userId - User ID
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} The created pantry item
 */
export const addToPantry = async (ingredientName, quantity = '', notes = '', userId, supabaseClient) => {
  try {
    const cleanedName = cleanIngredientForSearch(ingredientName);
    
    const pantryItem = {
      user_id: userId,
      ingredient_name: ingredientName.trim(),
      cleaned_name: cleanedName.toLowerCase().trim(),
      quantity: quantity.trim(),
      notes: notes.trim(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from('pantry_items')
      .upsert(pantryItem, {
        onConflict: 'user_id,cleaned_name'
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding to pantry:', error);
      throw error;
    }

    console.log('Successfully added to pantry:', data);
    return data;

  } catch (error) {
    console.error('addToPantry error:', error);
    throw error;
  }
};

/**
 * Removes an item from the user's pantry
 * @param {string} pantryItemId - The pantry item ID
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<void>}
 */
export const removeFromPantry = async (pantryItemId, supabaseClient) => {
  try {
    const { error } = await supabaseClient
      .from('pantry_items')
      .delete()
      .eq('id', pantryItemId);

    if (error) {
      console.error('Error removing from pantry:', error);
      throw error;
    }

    console.log('Successfully removed from pantry:', pantryItemId);

  } catch (error) {
    console.error('removeFromPantry error:', error);
    throw error;
  }
};

/**
 * Gets all pantry items for a user
 * @param {string} userId - User ID
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Array>} Array of pantry items
 */
export const getUserPantry = async (userId, supabaseClient) => {
  try {
    const { data, error } = await supabaseClient
      .from('pantry_items')
      .select('*')
      .eq('user_id', userId)
      .order('ingredient_name');

    if (error) {
      console.error('Error fetching pantry:', error);
      throw error;
    }

    return data || [];

  } catch (error) {
    console.error('getUserPantry error:', error);
    throw error;
  }
};

/**
 * Updates a pantry item
 * @param {string} pantryItemId - The pantry item ID
 * @param {Object} updates - Object with updates (quantity, notes, etc.)
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} The updated pantry item
 */
export const updatePantryItem = async (pantryItemId, updates, supabaseClient) => {
  try {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from('pantry_items')
      .update(updateData)
      .eq('id', pantryItemId)
      .select()
      .single();

    if (error) {
      console.error('Error updating pantry item:', error);
      throw error;
    }

    console.log('Successfully updated pantry item:', data);
    return data;

  } catch (error) {
    console.error('updatePantryItem error:', error);
    throw error;
  }
};

/**
 * Gets recipe suggestions based on pantry items
 * @param {string} userId - User ID
 * @param {Object} supabaseClient - Supabase client instance
 * @param {number} minMatchPercentage - Minimum match percentage (default: 30)
 * @returns {Promise<Array>} Array of recipe suggestions with match percentages
 */
export const getRecipeSuggestions = async (userId, supabaseClient, minMatchPercentage = 30) => {
  try {
    const { data, error } = await supabaseClient
      .from('recipe_suggestions')
      .select(`
        id,
        title,
        image_url,
        servings,
        prep_time,
        cook_time,
        source_url,
        total_ingredients,
        pantry_matches,
        match_percentage
      `)
      .eq('user_id', userId)
      .gte('match_percentage', minMatchPercentage)
      .order('match_percentage', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching recipe suggestions:', error);
      throw error;
    }

    return data || [];

  } catch (error) {
    console.error('getRecipeSuggestions error:', error);
    throw error;
  }
};

/**
 * Gets detailed recipe suggestion with missing ingredients using improved matching
 * @param {string} recipeId - Recipe ID
 * @param {string} userId - User ID
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Object>} Recipe details with pantry status
 */
export const getRecipeWithPantryStatus = async (recipeId, userId, supabaseClient) => {
  try {
    // Get recipe ingredients
    const { data: ingredients, error: ingredientsError } = await supabaseClient
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('position');

    if (ingredientsError) {
      throw ingredientsError;
    }

    // Get user's pantry items with full details for fuzzy matching
    const { data: pantryItems, error: pantryError } = await supabaseClient
      .from('pantry_items')
      .select('id, ingredient_name, cleaned_name, quantity, notes')
      .eq('user_id', userId);

    if (pantryError) {
      throw pantryError;
    }

    // Use improved matching algorithm
    const matchedIngredients = matchRecipeIngredientsToPantry(ingredients, pantryItems);

    const totalIngredients = ingredients.length;
    const availableIngredients = matchedIngredients.filter(ing => ing.inPantry).length;
    const missingIngredients = matchedIngredients.filter(ing => !ing.inPantry);

    // Enhance ingredients with match details
    const ingredientsWithStatus = matchedIngredients.map(match => ({
      ...match.ingredient,
      in_pantry: match.inPantry,
      missing: !match.inPantry,
      pantry_match: match.pantryMatch,
      match_score: match.matchScore,
      match_type: match.matchType,
      cleaned_ingredient: match.cleanedIngredient
    }));

    return {
      recipe_id: recipeId,
      ingredients: ingredientsWithStatus,
      total_ingredients: totalIngredients,
      available_ingredients: availableIngredients,
      missing_ingredients: missingIngredients,
      match_percentage: totalIngredients > 0 ? (availableIngredients / totalIngredients) * 100 : 0,
      matching_details: {
        exact_matches: matchedIngredients.filter(m => m.matchType === 'exact').length,
        fuzzy_matches: matchedIngredients.filter(m => m.matchType === 'fuzzy').length,
        synonym_matches: matchedIngredients.filter(m => m.matchType === 'synonym').length,
        partial_matches: matchedIngredients.filter(m => m.matchType === 'partial').length
      }
    };

  } catch (error) {
    console.error('getRecipeWithPantryStatus error:', error);
    throw error;
  }
};

/**
 * Bulk add ingredients to pantry from a recipe
 * @param {Array} ingredients - Array of ingredient strings
 * @param {string} userId - User ID  
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Array>} Array of added pantry items
 */
export const addRecipeIngredientsToPantry = async (ingredients, userId, supabaseClient) => {
  try {
    const pantryItems = ingredients.map(ingredient => {
      const cleanedName = cleanIngredientForSearch(ingredient);
      return {
        user_id: userId,
        ingredient_name: ingredient.trim(),
        cleaned_name: cleanedName.toLowerCase().trim(),
        quantity: '',
        notes: 'Added from recipe',
        updated_at: new Date().toISOString()
      };
    });

    const { data, error } = await supabaseClient
      .from('pantry_items')
      .upsert(pantryItems, {
        onConflict: 'user_id,cleaned_name'
      })
      .select();

    if (error) {
      console.error('Error bulk adding to pantry:', error);
      throw error;
    }

    console.log(`Successfully added ${data.length} ingredients to pantry`);
    return data;

  } catch (error) {
    console.error('addRecipeIngredientsToPantry error:', error);
    throw error;
  }
};