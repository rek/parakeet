-- Prescription trace: stores the full reasoning chain for each JIT-generated session
ALTER TABLE sessions ADD COLUMN jit_output_trace jsonb;
