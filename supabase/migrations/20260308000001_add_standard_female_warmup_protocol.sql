ALTER TABLE "public"."warmup_configs"
  DROP CONSTRAINT "warmup_configs_protocol_check",
  ADD CONSTRAINT "warmup_configs_protocol_check"
    CHECK ("protocol" = ANY (ARRAY[
      'standard'::"text",
      'minimal'::"text",
      'extended'::"text",
      'empty_bar'::"text",
      'custom'::"text",
      'standard_female'::"text"
    ]));
