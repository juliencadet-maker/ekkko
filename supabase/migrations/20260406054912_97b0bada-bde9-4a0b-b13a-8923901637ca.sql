ALTER TABLE asset_deliveries
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS asset_purpose TEXT,
  ADD COLUMN IF NOT EXISTS recipient_source TEXT CHECK (recipient_source IN ('suggested', 'manual'));

COMMENT ON COLUMN asset_deliveries.recipient_email IS 'Email du destinataire prospect — optionnel. Permet de relier delivery_token à une identité viewer.';
COMMENT ON COLUMN asset_deliveries.asset_purpose IS 'Hérité de deal_assets.asset_purpose au moment de la génération du lien.';
COMMENT ON COLUMN asset_deliveries.recipient_source IS 'Source du destinataire : suggested = contact powermap, manual = email saisi. NULL si recipient_email absent.';