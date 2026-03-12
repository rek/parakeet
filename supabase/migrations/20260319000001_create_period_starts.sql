-- The period_starts table was added to the initial schema dump after it had
-- already been applied to prod, so the table was never created there.

CREATE TABLE IF NOT EXISTS "public"."period_starts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."period_starts" OWNER TO "postgres";

DO $$ BEGIN
  ALTER TABLE ONLY "public"."period_starts"
      ADD CONSTRAINT "period_starts_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "period_starts_user_date_uniq"
  ON "public"."period_starts" USING "btree" ("user_id", "start_date");

DO $$ BEGIN
  ALTER TABLE ONLY "public"."period_starts"
      ADD CONSTRAINT "period_starts_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."period_starts" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users_own_data" ON "public"."period_starts"
      USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"))
      WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON TABLE "public"."period_starts" TO "anon";
GRANT ALL ON TABLE "public"."period_starts" TO "authenticated";
GRANT ALL ON TABLE "public"."period_starts" TO "service_role";

NOTIFY pgrst, 'reload schema';
