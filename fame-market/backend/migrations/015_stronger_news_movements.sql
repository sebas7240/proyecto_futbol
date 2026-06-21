ALTER TABLE news_signals
  DROP CONSTRAINT IF EXISTS news_signals_proposed_delta_bps_check,
  DROP CONSTRAINT IF EXISTS news_signals_applied_delta_bps_check;

ALTER TABLE news_signals
  ADD CONSTRAINT news_signals_proposed_delta_bps_check
    CHECK (proposed_delta_bps BETWEEN -1000 AND 1000),
  ADD CONSTRAINT news_signals_applied_delta_bps_check
    CHECK (applied_delta_bps BETWEEN -1000 AND 1000);

