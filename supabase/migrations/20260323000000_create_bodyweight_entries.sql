CREATE TABLE IF NOT EXISTS "public"."bodyweight_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recorded_date" "date" NOT NULL,
    "weight_kg" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."bodyweight_entries" OWNER TO "postgres";

DO $$ BEGIN
  ALTER TABLE ONLY "public"."bodyweight_entries"
      ADD CONSTRAINT "bodyweight_entries_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "bodyweight_entries_user_date_uniq"
  ON "public"."bodyweight_entries" USING "btree" ("user_id", "recorded_date");

DO $$ BEGIN
  ALTER TABLE ONLY "public"."bodyweight_entries"
      ADD CONSTRAINT "bodyweight_entries_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."bodyweight_entries" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users_own_data" ON "public"."bodyweight_entries"
      USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"))
      WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON TABLE "public"."bodyweight_entries" TO "anon";
GRANT ALL ON TABLE "public"."bodyweight_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."bodyweight_entries" TO "service_role";

-- Seed existing bodyweight values as initial entries
INSERT INTO "public"."bodyweight_entries" ("user_id", "recorded_date", "weight_kg")
SELECT "id", current_date, "bodyweight_kg"
FROM "public"."profiles"
WHERE "bodyweight_kg" IS NOT NULL
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
