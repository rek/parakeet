-- Drop the overly permissive INSERT policy (WITH CHECK (true))
DROP POLICY IF EXISTS "service role writes developer suggestions" ON "public"."developer_suggestions";

-- Add a proper INSERT policy: authenticated users can only insert their own rows
CREATE POLICY "users insert own developer suggestions"
  ON "public"."developer_suggestions"
  FOR INSERT
  WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));
