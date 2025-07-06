import { LitCostEstimator } from '../../utils/litCostEstimator';
import { AccessControlCondition } from '../../types/lit';
import { ethers } from 'ethers';

describe('LitCostEstimator', () => {
  const mockConditions: AccessControlCondition[] = [
    {
      contractAddress: '0x1234',
      standardContractType: 'ERC1155',
      chain: 'base',
      method: 'balanceOf',
      parameters: [':userAddress', 'userId123'],
      returnValueTest: {
        comparator: '>',
        value: '0'
      }
    },
    {
      contractAddress: '0x5678',
      standardContractType: 'Custom',
      chain: 'base',
      method: 'isProjectAuthorized',
      parameters: ['projectId456'],
      returnValueTest: {
        comparator: '=',
        value: 'true'
      }
    }
  ];

  describe('estimateSaveKeyCost', () => {
    it('should calculate cost based on conditions count', () => {
      const cost = LitCostEstimator.estimateSaveKeyCost(mockConditions);
      
      // Base cost + (condition cost * number of conditions)
      const expectedCost = ethers.parseEther('0.000001') + 
        (BigInt(mockConditions.length) * ethers.parseEther('0.0000002'));
      
      expect(cost).toBe(expectedCost);
    });

    it('should return base cost for no conditions', () => {
      const cost = LitCostEstimator.estimateSaveKeyCost([]);
      expect(cost).toBe(ethers.parseEther('0.000001'));
    });
  });

  describe('estimateGetKeyCost', () => {
    it('should calculate cost based on conditions count', () => {
      const cost = LitCostEstimator.estimateGetKeyCost(mockConditions);
      
      // Base cost + (condition cost * number of conditions)
      const expectedCost = ethers.parseEther('0.0000005') + 
        (BigInt(mockConditions.length) * ethers.parseEther('0.0000002'));
      
      expect(cost).toBe(expectedCost);
    });

    it('should return base cost for no conditions', () => {
      const cost = LitCostEstimator.estimateGetKeyCost([]);
      expect(cost).toBe(ethers.parseEther('0.0000005'));
    });
  });

  describe('formatCost', () => {
    it('should format wei to ETH string', () => {
      const wei = ethers.parseEther('0.000001');
      const formatted = LitCostEstimator.formatCost(wei);
      expect(formatted).toBe('0.000001 ETH');
    });

    it('should handle zero cost', () => {
      const formatted = LitCostEstimator.formatCost(BigInt(0));
      expect(formatted).toBe('0.0 ETH');
    });
  });

  describe('getCostBreakdown', () => {
    it('should provide detailed cost breakdown for save operation', () => {
      const breakdown = LitCostEstimator.getCostBreakdown('save', mockConditions);
      
      expect(breakdown).toEqual({
        baseCost: ethers.parseEther('0.000001'),
        conditionCost: BigInt(mockConditions.length) * ethers.parseEther('0.0000002'),
        totalCost: ethers.parseEther('0.000001') + 
          (BigInt(mockConditions.length) * ethers.parseEther('0.0000002')),
        formatted: {
          baseCost: '0.000001 ETH',
          conditionCost: expect.stringMatching(/^0\.0000004 ETH$/),
          totalCost: expect.stringMatching(/^0\.0000014 ETH$/)
        }
      });
    });

    it('should provide detailed cost breakdown for get operation', () => {
      const breakdown = LitCostEstimator.getCostBreakdown('get', mockConditions);
      
      expect(breakdown).toEqual({
        baseCost: ethers.parseEther('0.0000005'),
        conditionCost: BigInt(mockConditions.length) * ethers.parseEther('0.0000002'),
        totalCost: ethers.parseEther('0.0000005') + 
          (BigInt(mockConditions.length) * ethers.parseEther('0.0000002')),
        formatted: {
          baseCost: '0.0000005 ETH',
          conditionCost: expect.stringMatching(/^0\.0000004 ETH$/),
          totalCost: expect.stringMatching(/^0\.0000009 ETH$/)
        }
      });
    });

    it('should handle no conditions', () => {
      const breakdown = LitCostEstimator.getCostBreakdown('save', []);
      
      expect(breakdown).toEqual({
        baseCost: ethers.parseEther('0.000001'),
        conditionCost: BigInt(0),
        totalCost: ethers.parseEther('0.000001'),
        formatted: {
          baseCost: '0.000001 ETH',
          conditionCost: '0.0 ETH',
          totalCost: '0.000001 ETH'
        }
      });
    });
  });
}); 