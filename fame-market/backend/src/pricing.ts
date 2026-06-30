import type { TradeSide } from './types.js';

export const STARTING_BALANCE = 10_000;
export const FEE_RATE = 0.0025;
export const MAX_DAILY_MOVE = 0.12;
export const MAX_POSITION_SHARE = 0.2;
export const QUOTE_LIFETIME_MS = 15_000;
export const MIN_TRADE_QUANTITY = 0.000001;
export const MAX_TRADE_QUANTITY = 500;
export const TRADE_QUANTITY_DECIMALS = 6;
export const TRADE_QUANTITY_EPSILON = 0.0000005;

export const roundMoney = (value: number) => Number(value.toFixed(2));
export const roundPrice = (value: number) => Number(value.toFixed(6));
export const roundQuantity = (value: number) =>
  Number(value.toFixed(TRADE_QUANTITY_DECIMALS));

export function hasValidTradeQuantityPrecision(value: number) {
  return Math.abs(value - roundQuantity(value)) < 1e-10;
}

export function isValidTradeQuantity(value: number) {
  return (
    Number.isFinite(value) &&
    value >= MIN_TRADE_QUANTITY &&
    value <= MAX_TRADE_QUANTITY &&
    hasValidTradeQuantityPrecision(value)
  );
}

export function calculateQuote(
  currentPrice: number,
  dailyAnchorPrice: number,
  liquidity: number,
  side: TradeSide,
  quantity: number
) {
  const direction = side === 'buy' ? 1 : -1;
  const exponent = quantity / liquidity;
  const newPrice = currentPrice * Math.exp(direction * exponent);
  const dailyReturn = newPrice / dailyAnchorPrice - 1;

  const grossAmount =
    side === 'buy'
      ? currentPrice * liquidity * (Math.exp(exponent) - 1)
      : currentPrice * liquidity * (1 - Math.exp(-exponent));
  const fee = grossAmount * FEE_RATE;
  const netAmount = side === 'buy' ? grossAmount + fee : grossAmount - fee;

  return {
    newPrice: roundPrice(newPrice),
    dailyReturn,
    averagePrice: roundPrice(grossAmount / quantity),
    grossAmount: roundMoney(grossAmount),
    fee: roundMoney(fee),
    netAmount: roundMoney(netAmount)
  };
}
