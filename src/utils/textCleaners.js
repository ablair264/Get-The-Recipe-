// Utilities to tidy up ingredient and instruction text for display

const decodeHtmlEntities = (str) => {
  if (!str || typeof str !== 'string') return str;
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ',
    ndash: '–', mdash: '—', middot: '·', bull: '•', hellip: '…',
    // Common fraction entities
    frac12: '½', frac14: '¼', frac34: '¾',
    // Additional fractions often seen (HTML5 or site-specific)
    frac13: '⅓', frac23: '⅔',
    frac15: '⅕', frac25: '⅖', frac35: '⅗', frac45: '⅘',
    frac16: '⅙', frac56: '⅚',
    frac18: '⅛', frac38: '⅜', frac58: '⅝', frac78: '⅞',
  };
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code) => {
    if (code[0] === '#') {
      // numeric code: decimal or hex
      const isHex = code[1]?.toLowerCase() === 'x';
      const numStr = isHex ? code.slice(2) : code.slice(1);
      const cp = parseInt(numStr, isHex ? 16 : 10);
      if (!isNaN(cp)) {
        try { return String.fromCodePoint(cp); } catch { return m; }
      }
      return m;
    }
    const lower = code.toLowerCase();
    return Object.prototype.hasOwnProperty.call(named, lower) ? named[lower] : m;
  });
};

const tidyCommon = (str) => {
  if (!str || typeof str !== 'string') return str;
  let s = decodeHtmlEntities(str);
  // Normalize spaces
  s = s.replace(/\u00A0/g, ' '); // non-breaking space -> space
  s = s.replace(/\s{2,}/g, ' ');

  // Commas: no space before, single space after
  s = s.replace(/\s*,\s*/g, ', ');

  // Semicolons: single space after
  s = s.replace(/\s*;\s*/g, '; ');

  // Fix misplaced comma right after opening parenthesis: "(, foo)" -> "(foo)"
  s = s.replace(/\(\s*,\s*/g, '(');
  // Remove comma right before closing parenthesis: "(foo ,)" -> "(foo)"
  s = s.replace(/,\s*\)/g, ')');

  // Parentheses spacing: no space just inside, but space before "(" if stuck to word
  s = s.replace(/\(\s+/g, '(');
  s = s.replace(/\s+\)/g, ')');
  s = s.replace(/(\w)\(/g, '$1 (');

  // Add a space between numbers and following letters (e.g., 3lb -> 3 lb, 1.5kg -> 1.5 kg)
  s = s.replace(/(\d)([A-Za-z])/g, '$1 $2');
  // Add a space between unicode fraction chars and following letters (e.g., ½cup -> ½ cup)
  s = s.replace(/([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])([A-Za-z])/g, '$1 $2');

  // Normalize slashes: keep tight for word/word and digit/digit fractions; leave others as-is
  // Collapse spaces around slashes between letters (and/or -> and/or, flavor / nutrition -> flavor/nutrition)
  s = s.replace(/([A-Za-z])\s*\/\s*([A-Za-z])/g, '$1/$2');
  // Collapse spaces around numeric fractions
  s = s.replace(/(\d)\s*\/\s*(\d)/g, '$1/$2');

  // Remove space before periods
  s = s.replace(/\s+\./g, '.');

  // Final collapse of multiple spaces and trim
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
};

export const tidyIngredient = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  // First apply common cleaning
  let cleaned = tidyCommon(str);
  
  // Ingredient-specific cleaning rules
  
  // 1. Clean up complex parenthetical notes
  // Remove "Note X" references entirely
  cleaned = cleaned.replace(/\(Note \d+\)/gi, '');
  
  // 2. Simplify preparation notes in parentheses
  // Keep only essential prep info, remove verbose explanations
  cleaned = cleaned.replace(/\(([^)]*cut a "V" out of[^)]*)\)/gi, '(cored)');
  cleaned = cleaned.replace(/\(([^)]*remove the core[^)]*)\)/gi, '(cored)');
  cleaned = cleaned.replace(/\(([^)]*NOT peeled[^)]*)\)/gi, '(unpeeled)');
  cleaned = cleaned.replace(/\(([^)]*finely minced[^)]*)\)/gi, '(minced)');
  cleaned = cleaned.replace(/\(([^)]*roughly chopped[^)]*)\)/gi, '(chopped)');
  
  // 3. Clean up "optional" indicators
  // Simplify wordy optional notes
  cleaned = cleaned.replace(/\(optional[^)]*\)/gi, '(optional)');
  cleaned = cleaned.replace(/\(NOT CRITICAL[^)]*\)/gi, '(optional)');
  
  // 4. Handle measurement alternatives better
  // Convert "kg / lb" format to "kg (3 lb)" format for clarity
  cleaned = cleaned.replace(/(\d+(?:\.\d+)?)\s*kg\s*\/\s*(\d+(?:\.\d+)?)\s*lb/gi, '$1 kg ($2 lb)');
  cleaned = cleaned.replace(/(\d+(?:\.\d+)?)\s*lb\s*\/\s*(\d+(?:\.\d+)?)\s*kg/gi, '$1 lb ($2 kg)');
  
  // 5. Clean up measurement conversions in parentheses
  // Simplify "(4 cups)" to just show the conversion more cleanly
  cleaned = cleaned.replace(/litre\s*\((\d+\s*cups?)\)/gi, 'litre ($1)');
  cleaned = cleaned.replace(/(\d+(?:\.\d+)?)\s*g\s*\/\s*(\d+(?:\.\d+)?)\s*tbsp/gi, '$1g ($2 tbsp)');
  
  // 6. Clean up substitute instructions
  // Simplify substitution notes
  cleaned = cleaned.replace(/\(sub\s+([^,)]+)[^)]*\)/gi, '(or $1)');
  cleaned = cleaned.replace(/\(plus extra for[^)]*\)/gi, '(plus extra)');
  
  // 7. Remove redundant punctuation and spacing issues
  // Clean up multiple spaces, commas, and parentheses
  cleaned = cleaned.replace(/\s*,\s*\(/g, ' (');
  cleaned = cleaned.replace(/\)\s*,/g, '),');
  
  // 8. Handle edge cases
  // Remove empty parentheses
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  
  // Clean up trailing commas or periods
  cleaned = cleaned.replace(/[,.]$/, '');
  
  // 9. Final cleanup
  // Remove multiple spaces and trim
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  
  return cleaned;
};
export const tidyInstruction = (str) => tidyCommon(str);
export const tidyGeneric = (str) => tidyCommon(str);

export default { tidyIngredient, tidyInstruction, tidyGeneric };
