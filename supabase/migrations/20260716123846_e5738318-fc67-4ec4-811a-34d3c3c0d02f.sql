ALTER TABLE public.inventory_access_tokens
  ADD CONSTRAINT inventory_access_tokens_token_min_length
  CHECK (char_length(token) >= 32);