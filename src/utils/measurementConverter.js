// US to UK measurement conversions
const conversions = {
  // Volume conversions (US to UK)
  'cup': { multiplier: 250, unit: 'ml', ukEquivalent: '250ml' },
  'cups': { multiplier: 250, unit: 'ml', ukEquivalent: '250ml' },
  'tablespoon': { multiplier: 15, unit: 'ml', ukEquivalent: '15ml' },
  'tablespoons': { multiplier: 15, unit: 'ml', ukEquivalent: '15ml' },
  'tbsp': { multiplier: 15, unit: 'ml', ukEquivalent: '15ml' },
  'teaspoon': { multiplier: 5, unit: 'ml', ukEquivalent: '5ml' },
  'teaspoons': { multiplier: 5, unit: 'ml', ukEquivalent: '5ml' },
  'tsp': { multiplier: 5, unit: 'ml', ukEquivalent: '5ml' },
  'fluid ounce': { multiplier: 30, unit: 'ml', ukEquivalent: '30ml' },
  'fluid ounces': { multiplier: 30, unit: 'ml', ukEquivalent: '30ml' },
  'fl oz': { multiplier: 30, unit: 'ml', ukEquivalent: '30ml' },
  'pint': { multiplier: 475, unit: 'ml', ukEquivalent: '475ml' },
  'pints': { multiplier: 475, unit: 'ml', ukEquivalent: '475ml' },
  'quart': { multiplier: 950, unit: 'ml', ukEquivalent: '950ml' },
  'quarts': { multiplier: 950, unit: 'ml', ukEquivalent: '950ml' },
  
  // Weight conversions (US to UK - already compatible)
  'ounce': { multiplier: 1, unit: 'oz', ukEquivalent: 'oz' },
  'ounces': { multiplier: 1, unit: 'oz', ukEquivalent: 'oz' },
  'oz': { multiplier: 1, unit: 'oz', ukEquivalent: 'oz' },
  'pound': { multiplier: 1, unit: 'lb', ukEquivalent: 'lb' },
  'pounds': { multiplier: 1, unit: 'lb', ukEquivalent: 'lb' },
  'lb': { multiplier: 1, unit: 'lb', ukEquivalent: 'lb' },
  'lbs': { multiplier: 1, unit: 'lb', ukEquivalent: 'lb' },
  
  // Temperature (Fahrenheit to Celsius)
  '°f': { type: 'temperature' },
  'fahrenheit': { type: 'temperature' },
  'f': { type: 'temperature' }
};

// Convert Fahrenheit to Celsius
const fahrenheitToCelsius = (fahrenheit) => {
  return Math.round((fahrenheit - 32) * 5/9);
};

// Parse fractions like "1/2", "3/4", "1 1/2"
const parseFraction = (fractionStr) => {
  const mixedMatch = fractionStr.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const numerator = parseInt(mixedMatch[2]);
    const denominator = parseInt(mixedMatch[3]);
    return whole + (numerator / denominator);
  }
  
  const fractionMatch = fractionStr.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
  }
  
  return parseFloat(fractionStr) || 0;
};

// Format number to nice fractions for display
const formatToFraction = (decimal) => {
  if (decimal === 0) return '0';
  
  const whole = Math.floor(decimal);
  const remainder = decimal - whole;
  
  // Common fraction conversions
  const fractions = [
    { decimal: 0, fraction: '' },
    { decimal: 0.125, fraction: '1/8' },
    { decimal: 0.25, fraction: '1/4' },
    { decimal: 0.333, fraction: '1/3' },
    { decimal: 0.375, fraction: '3/8' },
    { decimal: 0.5, fraction: '1/2' },
    { decimal: 0.625, fraction: '5/8' },
    { decimal: 0.667, fraction: '2/3' },
    { decimal: 0.75, fraction: '3/4' },
    { decimal: 0.875, fraction: '7/8' }
  ];
  
  // Find closest fraction
  let closest = fractions[0];
  let minDiff = Math.abs(remainder - closest.decimal);
  
  for (const frac of fractions) {
    const diff = Math.abs(remainder - frac.decimal);
    if (diff < minDiff) {
      minDiff = diff;
      closest = frac;
    }
  }
  
  // If difference is too large, use decimal
  if (minDiff > 0.05) {
    return decimal.toFixed(1);
  }
  
  if (whole === 0) {
    return closest.fraction || '0';
  } else if (closest.fraction) {
    return `${whole} ${closest.fraction}`;
  } else {
    return whole.toString();
  }
};

// Main conversion function
export const convertToUK = (ingredient) => {
  if (!ingredient) return ingredient;
  
  // Look for temperature conversions first
  const tempMatch = ingredient.match(/(\d+)°?[Ff]\b/);
  if (tempMatch) {
    const fahrenheit = parseInt(tempMatch[1]);
    const celsius = fahrenheitToCelsius(fahrenheit);
    return ingredient.replace(/(\d+)°?[Ff]\b/, `${celsius}°C`);
  }
  
  // Look for measurement conversions
  const measurementRegex = /(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)\s*(cups?|tablespoons?|tbsp|teaspoons?|tsp|fluid\s+ounces?|fl\s+oz|pints?|quarts?|ounces?|oz|pounds?|lbs?|lb)\b/gi;
  
  return ingredient.replace(measurementRegex, (match, amount, unit) => {
    const unitLower = unit.toLowerCase().replace(/\s+/g, ' ');
    const conversion = conversions[unitLower];
    
    if (!conversion || conversion.type === 'temperature') {
      return match; // Return original if no conversion found
    }
    
    const numericAmount = parseFraction(amount);
    
    if (conversion.unit === 'oz' || conversion.unit === 'lb') {
      // Weight measurements - keep as is but clean up
      return `${formatToFraction(numericAmount)} ${conversion.unit}`;
    }
    
    // Volume conversions to ml/litres
    const convertedAmount = numericAmount * conversion.multiplier;
    
    if (convertedAmount >= 1000) {
      const litres = convertedAmount / 1000;
      return `${formatToFraction(litres)} litre${litres !== 1 ? 's' : ''}`;
    } else {
      return `${Math.round(convertedAmount)}ml`;
    }
  });
};

// Convert entire ingredients array
export const convertIngredientsToUK = (ingredients) => {
  return ingredients.map(ingredient => convertToUK(ingredient));
};

// Check if ingredient contains US measurements
export const hasUSMeasurements = (ingredient) => {
  const usUnits = /\b(cups?|tablespoons?|tbsp|teaspoons?|tsp|fluid\s+ounces?|fl\s+oz|pints?|quarts?|\d+°?[Ff])\b/gi;
  return usUnits.test(ingredient);
};

