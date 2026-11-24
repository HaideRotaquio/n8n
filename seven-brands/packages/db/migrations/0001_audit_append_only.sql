-- The audit log is append-only: block UPDATE and DELETE at the database level.
-- Exception: ON DELETE SET NULL cascades from user/brand deletion only touch FK columns;
-- we allow updates that change nothing except actor_user_id/brand_id to NULL.
CREATE OR REPLACE FUNCTION audit_log_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_log is append-only (DELETE blocked)';
  END IF;
  IF NEW.id = OLD.id
     AND NEW.action = OLD.action
     AND NEW.entity_type = OLD.entity_type
     AND NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id
     AND NEW.before IS NOT DISTINCT FROM OLD.before
     AND NEW.after IS NOT DISTINCT FROM OLD.after
     AND NEW.created_at = OLD.created_at
     AND NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address
     AND NEW.user_agent IS NOT DISTINCT FROM OLD.user_agent
     AND (NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id OR NEW.actor_user_id IS NULL)
     AND (NEW.brand_id IS NOT DISTINCT FROM OLD.brand_id OR NEW.brand_id IS NULL)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only (UPDATE blocked)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_guard();
