-- Create individual ingredients table
CREATE TABLE recipe_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID REFERENCES saved_recipes(id) ON DELETE CASCADE,
  ingredient_text TEXT NOT NULL,
  cleaned_ingredient TEXT NOT NULL, -- normalized/cleaned version for matching
  position INTEGER NOT NULL, -- to maintain order
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pantry items table
CREATE TABLE pantry_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  cleaned_name TEXT NOT NULL, -- normalized for matching
  quantity TEXT, -- optional quantity like "2 cups", "1 lb"
  notes TEXT, -- optional notes like "expires soon"
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, cleaned_name)
);

-- Create recipe suggestions view
CREATE OR REPLACE VIEW recipe_suggestions AS
SELECT 
  r.id,
  r.title,
  r.image_url,
  r.servings,
  r.prep_time,
  r.cook_time,
  r.source_url,
  COUNT(ri.id) as total_ingredients,
  COUNT(pi.id) as pantry_matches,
  ROUND((COUNT(pi.id)::numeric / COUNT(ri.id)::numeric) * 100, 1) as match_percentage
FROM saved_recipes r
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
LEFT JOIN pantry_items pi ON ri.cleaned_ingredient = pi.cleaned_name AND pi.user_id = r.user_id
GROUP BY r.id, r.title, r.image_url, r.servings, r.prep_time, r.cook_time, r.source_url
ORDER BY match_percentage DESC, total_ingredients ASC;

-- Create indexes for performance
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_cleaned ON recipe_ingredients(cleaned_ingredient);
CREATE INDEX idx_pantry_items_user_id ON pantry_items(user_id);
CREATE INDEX idx_pantry_items_cleaned ON pantry_items(cleaned_name);

-- RLS policies
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;

-- Recipe ingredients policies (users can only see ingredients for their recipes)
CREATE POLICY "Users can view their recipe ingredients" ON recipe_ingredients
  FOR SELECT USING (
    recipe_id IN (
      SELECT id FROM saved_recipes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their recipe ingredients" ON recipe_ingredients
  FOR INSERT WITH CHECK (
    recipe_id IN (
      SELECT id FROM saved_recipes WHERE user_id = auth.uid()
    )
  );

-- Pantry items policies
CREATE POLICY "Users can manage their pantry" ON pantry_items
  FOR ALL USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON recipe_ingredients TO authenticated;
GRANT ALL ON pantry_items TO authenticated;
GRANT SELECT ON recipe_suggestions TO authenticated;