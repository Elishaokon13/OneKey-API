import { LitCostEstimator } from '../../utils/litCostEstimator';

describe('LitCostEstimator', () => {
  const mockConditions = [
    {
      contractAddress: '0x123',
      standardContractType: 'ERC20',
      chain: 'ethereum',
      method: 'balanceOf',
      parameters: ['address'],
      returnValueTest: {
        comparator: '>',
        value: '100'
      }
    }
  ];

  describe('estimateCost', () => {
    it('should estimate cost correctly for ethereum chain', () => {
      const cost = LitCostEstimator.estimateCost(mockConditions, 'ethereum');
      expect(cost).toBeCloseTo(0.0015, 4); // BASE_COST + CONDITION_COST * chainMultiplier
    });

    it('should estimate cost correctly for polygon chain', () => {
      const cost = LitCostEstimator.estimateCost(mockConditions, 'polygon');
      expect(cost).toBeCloseTo(0.0012, 4); // (BASE_COST + CONDITION_COST) * 0.8
    });

    it('should handle empty conditions', () => {
      const cost = LitCostEstimator.estimateCost([], 'ethereum');
      expect(cost).toBe(0.001); // BASE_COST only
    });

    it('should use default multiplier for unknown chain', () => {
      const cost = LitCostEstimator.estimateCost(mockConditions, 'unknown-chain');
      expect(cost).toBeCloseTo(0.0015, 4); // Uses default multiplier of 1.0
    });
  });

  describe('getChainMultiplier', () => {
    it('should return correct multiplier for known chains', () => {
      expect(LitCostEstimator.getChainMultiplier('ethereum')).toBe(1.0);
      expect(LitCostEstimator.getChainMultiplier('polygon')).toBe(0.8);
      expect(LitCostEstimator.getChainMultiplier('optimism')).toBe(0.9);
      expect(LitCostEstimator.getChainMultiplier('arbitrum')).toBe(0.9);
      expect(LitCostEstimator.getChainMultiplier('bsc')).toBe(0.7);
    });

    it('should return default multiplier for unknown chain', () => {
      expect(LitCostEstimator.getChainMultiplier('unknown-chain')).toBe(1.0);
    });
  });
}); 