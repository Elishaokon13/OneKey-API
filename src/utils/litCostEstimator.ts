export class LitCostEstimator {
  private static readonly BASE_COST = 0.001; // Base cost in USD
  private static readonly CONDITION_COST = 0.0005; // Cost per condition in USD
  private static readonly CHAIN_MULTIPLIERS: Record<string, number> = {
    'ethereum': 1.0,
    'polygon': 0.8,
    'optimism': 0.9,
    'arbitrum': 0.9,
    'bsc': 0.7
  };

  public static estimateCost(conditions: any[], chain: string): number {
    const chainMultiplier = this.CHAIN_MULTIPLIERS[chain] || 1.0;
    const conditionsCost = conditions.length * this.CONDITION_COST;
    return (this.BASE_COST + conditionsCost) * chainMultiplier;
  }

  public static getChainMultiplier(chain: string): number {
    return this.CHAIN_MULTIPLIERS[chain] || 1.0;
  }
} 