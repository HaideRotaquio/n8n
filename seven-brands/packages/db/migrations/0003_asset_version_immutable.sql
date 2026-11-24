-- Asset versions are immutable snapshots: block changes to their content.
CREATE OR REPLACE FUNCTION asset_version_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.definition IS DISTINCT FROM OLD.definition
     OR NEW.checksum IS DISTINCT FROM OLD.checksum
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.asset_id IS DISTINCT FROM OLD.asset_id THEN
    RAISE EXCEPTION 'asset_version is immutable; create a new version instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER asset_version_immutable
  BEFORE UPDATE ON asset_version
  FOR EACH ROW EXECUTE FUNCTION asset_version_guard();
