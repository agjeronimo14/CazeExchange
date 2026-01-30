-- Add flexible per-user branding settings
-- Stores JSON: { theme, accent, brand_name }

ALTER TABLE user_settings ADD COLUMN brand_json TEXT;
