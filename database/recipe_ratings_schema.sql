-- Recipe Ratings Table Schema
-- Add this to your Supabase database to enable recipe rating functionality

CREATE TABLE public.recipe_ratings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  recipe_url text NOT NULL,
  recipe_title text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recipe_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT recipe_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT recipe_ratings_unique_user_recipe UNIQUE (user_id, recipe_url)
);

-- Create indexes for better performance
CREATE INDEX idx_recipe_ratings_recipe_url ON public.recipe_ratings(recipe_url);
CREATE INDEX idx_recipe_ratings_user_id ON public.recipe_ratings(user_id);
CREATE INDEX idx_recipe_ratings_rating ON public.recipe_ratings(rating);

-- Enable Row Level Security
ALTER TABLE public.recipe_ratings ENABLE row level security;

-- Create RLS policies
CREATE POLICY "Users can view all recipe ratings" ON public.recipe_ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own ratings" ON public.recipe_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON public.recipe_ratings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON public.recipe_ratings
  FOR DELETE USING (auth.uid() = user_id);

-- Create a view for top-rated recipes (useful for the parser page)
CREATE OR REPLACE VIEW public.top_rated_recipes AS
SELECT 
  recipe_url,
  recipe_title,
  AVG(rating) as average_rating,
  COUNT(*) as total_ratings,
  MAX(updated_at) as last_rated
FROM public.recipe_ratings
GROUP BY recipe_url, recipe_title
HAVING COUNT(*) >= 3  -- Only show recipes with at least 3 ratings
ORDER BY average_rating DESC, total_ratings DESC;

-- Grant permissions
GRANT SELECT ON public.top_rated_recipes TO authenticated;
GRANT ALL ON public.recipe_ratings TO authenticated;