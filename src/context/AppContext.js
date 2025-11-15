import React from 'react';

export const AppContext = React.createContext({
  // User and auth
  user: null,
  supabaseClient: null,

  // Recipes
  savedRecipes: [],
  fetchedRecipes: [],
  categories: [],

  // Recipe operations
  saveRecipe: async () => {},
  deleteRecipe: async () => {},
  saveFetchedRecipe: async () => {},
  loadFetchedRecipes: async () => {},
  markRecipeDeclined: async () => {},

  // Categories
  addCategory: async () => {},

  // Settings
  useUKMeasurements: false,
  setUseUKMeasurements: () => {},

  // Utilities
  ingredientsToUK: () => {},
  hasUSMeasurements: () => {},
  importedUrl: null,
  setImportedUrl: () => {},
  API_BASE_URL: '',
});

