-- Existing rows were duplicated by earlier seed runs (there was no constraint
-- for onConflictDoNothing to catch), so collapse them before adding it.
DELETE FROM "role_permissions" a USING "role_permissions" b
  WHERE a.id > b.id AND a.role_id = b.role_id AND a.permission_id = b.permission_id;--> statement-breakpoint
DELETE FROM "user_permissions" a USING "user_permissions" b
  WHERE a.id > b.id AND a.user_id = b.user_id AND a.permission_id = b.permission_id;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_permission_id_unique" UNIQUE("role_id","permission_id");--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_permission_id_unique" UNIQUE("user_id","permission_id");