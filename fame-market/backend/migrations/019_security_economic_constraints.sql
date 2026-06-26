ALTER TABLE wallets
  ADD CONSTRAINT wallets_available_balance_non_negative
    CHECK (available_balance >= 0) NOT VALID;

ALTER TABLE wallets
  VALIDATE CONSTRAINT wallets_available_balance_non_negative;

ALTER TABLE artists
  ADD CONSTRAINT artists_prices_positive
    CHECK (
      current_price > 0
      AND opening_price > 0
      AND daily_anchor_price > 0
      AND liquidity > 0
    ) NOT VALID;

ALTER TABLE artists
  VALIDATE CONSTRAINT artists_prices_positive;

ALTER TABLE positions
  ADD CONSTRAINT positions_average_cost_non_negative
    CHECK (average_cost >= 0) NOT VALID;

ALTER TABLE positions
  VALIDATE CONSTRAINT positions_average_cost_non_negative;

ALTER TABLE trade_quotes
  ADD CONSTRAINT trade_quotes_economic_values_valid
    CHECK (
      quantity > 0
      AND average_price > 0
      AND gross_amount >= 0
      AND fee >= 0
      AND net_amount >= 0
      AND new_price > 0
    ) NOT VALID;

ALTER TABLE trade_quotes
  VALIDATE CONSTRAINT trade_quotes_economic_values_valid;

ALTER TABLE trades
  ADD CONSTRAINT trades_economic_values_valid
    CHECK (
      quantity > 0
      AND average_price > 0
      AND gross_amount >= 0
      AND fee >= 0
    ) NOT VALID;

ALTER TABLE trades
  VALIDATE CONSTRAINT trades_economic_values_valid;

ALTER TABLE price_ticks
  ADD CONSTRAINT price_ticks_price_positive
    CHECK (price > 0) NOT VALID;

ALTER TABLE price_ticks
  VALIDATE CONSTRAINT price_ticks_price_positive;
