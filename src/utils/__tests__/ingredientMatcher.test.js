import { 
  findBestIngredientMatch,
  matchRecipeIngredientsToPantry,
  calculateSimilarity,
  normalizePlural,
  INGREDIENT_SYNONYMS
} from '../ingredientMatcher';
import { cleanIngredientForSearch } from '../ingredientPriceService';

// Mock pantry items for testing
const mockPantryItems = [
  { id: '1', ingredient_name: 'Tomatoes', cleaned_name: 'tomatoes' },
  { id: '2', ingredient_name: 'Olive Oil', cleaned_name: 'olive oil' },
  { id: '3', ingredient_name: 'All-Purpose Flour', cleaned_name: 'flour' },
  { id: '4', ingredient_name: 'Scallions', cleaned_name: 'scallions' },
  { id: '5', ingredient_name: 'Fresh Cilantro', cleaned_name: 'cilantro' },
  { id: '6', ingredient_name: 'Ground Beef', cleaned_name: 'ground beef' },
  { id: '7', ingredient_name: 'Parmesan Cheese', cleaned_name: 'parmesan cheese' }
];

// Test cases that previously failed
const testCases = [
  {
    name: 'Exact Match',
    recipeIngredient: '2 cups diced tomatoes',
    expectedMatch: 'tomatoes',
    expectedType: 'exact'
  },
  {
    name: 'Plural/Singular Normalization',
    recipeIngredient: '1 large tomato',
    expectedMatch: 'tomatoes',
    expectedType: 'normalized'
  },
  {
    name: 'Compound Ingredient Cleaning',
    recipeIngredient: '3 tbsp extra virgin olive oil',
    expectedMatch: 'olive oil',
    expectedType: 'exact'
  },
  {
    name: 'All-Purpose Flour Cleaning',
    recipeIngredient: '2 cups all-purpose flour',
    expectedMatch: 'flour',
    expectedType: 'exact'
  },
  {
    name: 'Synonym Matching - Scallions/Green Onions',
    recipeIngredient: '2 green onions chopped',
    expectedMatch: 'scallions',
    expectedType: 'synonym'
  },
  {
    name: 'Synonym Matching - Cilantro/Coriander',
    recipeIngredient: '1/4 cup fresh coriander',
    expectedMatch: 'cilantro',
    expectedType: 'synonym'
  },
  {
    name: 'Substring Matching - Cheese',
    recipeIngredient: '1/2 cup grated cheese',
    expectedMatch: 'parmesan cheese',
    expectedType: 'substring'
  },
  {
    name: 'Fuzzy Matching - Beef Variations',
    recipeIngredient: '1 lb beef mince',
    expectedMatch: 'ground beef',
    expectedType: 'fuzzy'
  }
];

describe('Ingredient Matching System', () => {
  describe('cleanIngredientForSearch improvements', () => {
    test('should preserve olive oil from extra virgin olive oil', () => {
      expect(cleanIngredientForSearch('3 tbsp extra virgin olive oil')).toBe('olive oil');
    });

    test('should preserve flour from all-purpose flour', () => {
      expect(cleanIngredientForSearch('2 cups all-purpose flour')).toBe('flour');
    });

    test('should handle chocolate chips correctly', () => {
      expect(cleanIngredientForSearch('1 cup dark chocolate chips')).toBe('chocolate chips');
    });

    test('should preserve important nouns', () => {
      expect(cleanIngredientForSearch('1 tsp vanilla extract')).toBe('vanilla');
      expect(cleanIngredientForSearch('2 cups chicken stock')).toBe('chicken stock');
    });
  });

  describe('String similarity calculation', () => {
    test('should calculate similarity correctly', () => {
      expect(calculateSimilarity('tomato', 'tomatoes')).toBeGreaterThan(0.8);
      expect(calculateSimilarity('beef', 'beef')).toBe(1);
      expect(calculateSimilarity('apple', 'orange')).toBeLessThan(0.5);
    });
  });

  describe('Plural normalization', () => {
    test('should normalize plurals correctly', () => {
      expect(normalizePlural('tomatoes')).toBe('tomato');
      expect(normalizePlural('cherries')).toBe('cherry');
      expect(normalizePlural('potatoes')).toBe('potato');
      expect(normalizePlural('onion')).toBe('onion');
    });
  });

  describe('Ingredient synonym system', () => {
    test('should have scallion synonyms', () => {
      expect(INGREDIENT_SYNONYMS['scallions']).toContain('green onions');
      expect(INGREDIENT_SYNONYMS['green onions']).toContain('scallions');
    });

    test('should have cilantro synonyms', () => {
      expect(INGREDIENT_SYNONYMS['cilantro']).toContain('coriander');
      expect(INGREDIENT_SYNONYMS['coriander']).toContain('cilantro');
    });
  });

  describe('Best ingredient matching', () => {
    testCases.forEach(testCase => {
      test(`should match ${testCase.name}`, () => {
        const match = findBestIngredientMatch(testCase.recipeIngredient, mockPantryItems);
        
        expect(match).toBeTruthy();
        expect(match.item.cleaned_name).toBe(testCase.expectedMatch);
        expect(match.matchType).toBe(testCase.expectedType);
        expect(match.score).toBeGreaterThan(0.6);
      });
    });

    test('should return null for no matches', () => {
      const match = findBestIngredientMatch('exotic dragon fruit', mockPantryItems);
      expect(match).toBeNull();
    });

    test('should prioritize exact matches over fuzzy matches', () => {
      const match = findBestIngredientMatch('olive oil', mockPantryItems);
      expect(match.matchType).toBe('exact');
      expect(match.score).toBe(1.0);
    });
  });

  describe('Recipe ingredient batch matching', () => {
    const mockRecipeIngredients = [
      { ingredient_text: '2 cups diced tomatoes' },
      { ingredient_text: '3 tbsp extra virgin olive oil' },
      { ingredient_text: '2 green onions chopped' },
      { ingredient_text: '1 cup unknown ingredient' }
    ];

    test('should match multiple ingredients correctly', () => {
      const matches = matchRecipeIngredientsToPantry(mockRecipeIngredients, mockPantryItems);
      
      expect(matches).toHaveLength(4);
      
      // Check tomatoes match
      expect(matches[0].inPantry).toBe(true);
      expect(matches[0].pantryMatch.cleaned_name).toBe('tomatoes');
      
      // Check olive oil match
      expect(matches[1].inPantry).toBe(true);
      expect(matches[1].pantryMatch.cleaned_name).toBe('olive oil');
      
      // Check scallions/green onions match
      expect(matches[2].inPantry).toBe(true);
      expect(matches[2].pantryMatch.cleaned_name).toBe('scallions');
      
      // Check unknown ingredient doesn't match
      expect(matches[3].inPantry).toBe(false);
      expect(matches[3].pantryMatch).toBeNull();
    });
  });
});

// Manual test runner (for console testing)
export const runManualTests = () => {
  console.log('🧪 Running Ingredient Matching Tests...\n');
  
  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`Recipe: "${testCase.recipeIngredient}"`);
    
    const cleaned = cleanIngredientForSearch(testCase.recipeIngredient);
    console.log(`Cleaned: "${cleaned}"`);
    
    const match = findBestIngredientMatch(testCase.recipeIngredient, mockPantryItems);
    
    if (match) {
      console.log(`✅ Match found: "${match.item.cleaned_name}" (${match.matchType}, score: ${match.score.toFixed(2)})`);
      
      if (match.item.cleaned_name === testCase.expectedMatch) {
        console.log(`✅ Expected match confirmed!`);
      } else {
        console.log(`❌ Expected "${testCase.expectedMatch}", got "${match.item.cleaned_name}"`);
      }
    } else {
      console.log(`❌ No match found`);
    }
    
    console.log('');
  });
  
  // Test the full recipe matching
  console.log('🍽️ Testing full recipe matching...');
  const sampleRecipe = [
    { ingredient_text: '2 cups diced tomatoes' },
    { ingredient_text: '3 tbsp extra virgin olive oil' },
    { ingredient_text: '2 cups all-purpose flour' },
    { ingredient_text: '2 green onions chopped' },
    { ingredient_text: '1/4 cup fresh coriander' },
    { ingredient_text: '1 lb ground beef' }
  ];
  
  const matches = matchRecipeIngredientsToPantry(sampleRecipe, mockPantryItems);
  const matchedCount = matches.filter(m => m.inPantry).length;
  
  console.log(`📊 Results: ${matchedCount}/${matches.length} ingredients matched`);
  matches.forEach((match, i) => {
    const status = match.inPantry ? '✅' : '❌';
    const pantryItem = match.pantryMatch ? `-> ${match.pantryMatch.cleaned_name}` : '';
    console.log(`   ${status} ${match.cleanedIngredient} ${pantryItem}`);
  });
};