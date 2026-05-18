-- Explicit Data API grants for tables created without them.
--
-- Supabase is changing the default: new tables in "public" will no longer be
-- exposed to the Data API (supabase-js / PostgREST / GraphQL) without explicit
-- GRANTs. The change hits new projects on 2026-05-30 and existing projects on
-- 2026-10-30. On prod these grants are already implicitly held, so this
-- migration is a no-op there; on freshly-provisioned projects (branch previews,
-- new staging, future spin-ups) it restores Data API access. RLS already
-- gates row visibility for each of these tables.
--
-- See: https://supabase.com/blog/data-api-default-deny

GRANT ALL ON TABLE "public"."motivational_message_logs" TO "anon";
GRANT ALL ON TABLE "public"."motivational_message_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."motivational_message_logs" TO "service_role";

GRANT ALL ON TABLE "public"."weekly_body_reviews" TO "anon";
GRANT ALL ON TABLE "public"."weekly_body_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_body_reviews" TO "service_role";

GRANT ALL ON TABLE "public"."challenge_reviews" TO "anon";
GRANT ALL ON TABLE "public"."challenge_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_reviews" TO "service_role";

GRANT ALL ON TABLE "public"."decision_replay_logs" TO "anon";
GRANT ALL ON TABLE "public"."decision_replay_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."decision_replay_logs" TO "service_role";

GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";

GRANT ALL ON TABLE "public"."modifier_calibrations" TO "anon";
GRANT ALL ON TABLE "public"."modifier_calibrations" TO "authenticated";
GRANT ALL ON TABLE "public"."modifier_calibrations" TO "service_role";

GRANT ALL ON TABLE "public"."session_videos" TO "anon";
GRANT ALL ON TABLE "public"."session_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."session_videos" TO "service_role";

GRANT ALL ON TABLE "public"."gym_partners" TO "anon";
GRANT ALL ON TABLE "public"."gym_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."gym_partners" TO "service_role";

GRANT ALL ON TABLE "public"."gym_partner_invites" TO "anon";
GRANT ALL ON TABLE "public"."gym_partner_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."gym_partner_invites" TO "service_role";

GRANT ALL ON TABLE "public"."ai_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."ai_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_rate_limits" TO "service_role";

GRANT ALL ON TABLE "public"."set_logs" TO "anon";
GRANT ALL ON TABLE "public"."set_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."set_logs" TO "service_role";

GRANT ALL ON TABLE "public"."diet_protocols" TO "anon";
GRANT ALL ON TABLE "public"."diet_protocols" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_protocols" TO "service_role";

GRANT ALL ON TABLE "public"."diet_foods" TO "anon";
GRANT ALL ON TABLE "public"."diet_foods" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_foods" TO "service_role";

GRANT ALL ON TABLE "public"."diet_protocol_foods" TO "anon";
GRANT ALL ON TABLE "public"."diet_protocol_foods" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_protocol_foods" TO "service_role";

GRANT ALL ON TABLE "public"."diet_supplements" TO "anon";
GRANT ALL ON TABLE "public"."diet_supplements" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_supplements" TO "service_role";

GRANT ALL ON TABLE "public"."diet_lifestyle" TO "anon";
GRANT ALL ON TABLE "public"."diet_lifestyle" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_lifestyle" TO "service_role";

GRANT ALL ON TABLE "public"."diet_food_nutrition" TO "anon";
GRANT ALL ON TABLE "public"."diet_food_nutrition" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_food_nutrition" TO "service_role";

GRANT ALL ON TABLE "public"."lipedema_measurements" TO "anon";
GRANT ALL ON TABLE "public"."lipedema_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."lipedema_measurements" TO "service_role";

GRANT ALL ON TABLE "public"."biometric_readings" TO "anon";
GRANT ALL ON TABLE "public"."biometric_readings" TO "authenticated";
GRANT ALL ON TABLE "public"."biometric_readings" TO "service_role";

GRANT ALL ON TABLE "public"."recovery_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."recovery_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."recovery_snapshots" TO "service_role";

NOTIFY pgrst, 'reload schema';
