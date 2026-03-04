CREATE TABLE "public"."period_starts" (
  "id"         uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id"    uuid NOT NULL,
  "start_date" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "period_starts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "period_starts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "period_starts_user_date_uniq"
  ON "public"."period_starts" ("user_id", "start_date");

ALTER TABLE "public"."period_starts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_data" ON "public"."period_starts"
  USING ((select auth.uid()) = "user_id")
  WITH CHECK ((select auth.uid()) = "user_id");
