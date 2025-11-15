import { cleanIngredientForSearch } from './ingredientPriceService';

/**
 * Parses and normalizes ingredients from a recipe
 * @param {Array} ingredients - Array of ingredient strings
 * @returns {Array} Array of ingredient objects with original text and cleaned name
 */
export const parseIngredients = (ingredients) => {
  if (!Array.isArray(ingredients)) {
    console.warn('parseIngredients: Expected array, got:', typeof ingredients);
    return [];
  }

  return ingredients.map((ingredient, index) => {
    if (typeof ingredient !== 'string') {
      console.warn('parseIngredients: Expected string ingredient, got:', typeof ingredient);
      return {
        position: index,
        ingredient_text: String(ingredient || ''),
        cleaned_ingredient: ''
      };
    }

    const cleanedName = cleanIngredientForSearch(ingredient);
    
    return {
      position: index,
      ingredient_text: ingredient.trim(),
      cleaned_ingredient: cleanedName.toLowerCase().trim()
    };
  }).filter(item => item.ingredient_text.length > 0); // Remove empty ingredients
};

/**
 * Saves individual ingredients to the database
 * @param {string} recipeId - The saved recipe ID
 * @param {Array} ingredients - Array of ingredient strings
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Array>} Array of saved ingredient records
 */
export const saveRecipeIngredients = async (recipeId, ingredients, supabaseClient) => {
  try {
    const parsedIngredients = parseIngredients(ingredients);
    
    if (parsedIngredients.length === 0) {
      console.warn('saveRecipeIngredients: No valid ingredients to save');
      return [];
    }

    // Add recipe_id to each ingredient
    const ingredientsToSave = parsedIngredients.map(ingredient => ({
      ...ingredient,
      recipe_id: recipeId
    }));

    const { data, error } = await supabaseClient
      .from('recipe_ingredients')
      .insert(ingredientsToSave)
      .select();

    if (error) {
      console.error('Error saving recipe ingredients:', error);
      throw error;
    }

    console.log(`Successfully saved ${data.length} ingredients for recipe ${recipeId}`);
    return data;

  } catch (error) {
    console.error('saveRecipeIngredients error:', error);
    throw error;
  }
};

/**
 * Gets ingredients for a recipe from the database
 * @param {string} recipeId - The recipe ID
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<Array>} Array of ingredient records
 */
export const getRecipeIngredients = async (recipeId, supabaseClient) => {
  try {
    const { data, error } = await supabaseClient
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('position');

    if (error) {
      console.error('Error fetching recipe ingredients:', error);
      throw error;
    }

    return data || [];

  } catch (error) {
    console.error('getRecipeIngredients error:', error);
    throw error;
  }
};

/**
 * Deletes all ingredients for a recipe
 * @param {string} recipeId - The recipe ID
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<void>}
 */
export const deleteRecipeIngredients = async (recipeId, supabaseClient) => {
  try {
    const { error } = await supabaseClient
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId);

    if (error) {
      console.error('Error deleting recipe ingredients:', error);
      throw error;
    }

    console.log(`Successfully deleted ingredients for recipe ${recipeId}`);

  } catch (error) {
    console.error('deleteRecipeIngredients error:', error);
    throw error;
  }
};