// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseOverrideFee} from "@openzeppelin/uniswap-hooks/src/fee/BaseOverrideFee.sol";
import {BaseHook}        from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {IPoolManager}    from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey}         from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams}      from "@uniswap/v4-core/src/types/PoolOperation.sol";

/**
 * SashaDynamicFeeHook — Uniswap v4 Hook powered by Sasha's AI signal
 *
 * Architecture:
 *
 *   [Sasha's 5-source signal pipeline]
 *         ↓  every 6 hours (autonomous, no human needed)
 *   [SashaOracle.setFee()]  ← push-signal-to-xlayer.js
 *         ↓  on every swap
 *   [SashaDynamicFeeHook._getFee()]
 *         ↓
 *   [Uniswap v4 beforeSwap — OVERRIDE_FEE_FLAG applied]
 *         ↓
 *   LP earns fee matching Sasha's current market read
 *
 * Signal → Fee:
 *   Sasha reads market as risky  ("risk-off") → 10000 (1.0%)  — protect LPs
 *   Sasha reads market as calm   ("neutral")  → 3000  (0.3%)  — standard
 *   Sasha reads market as strong ("risk-on")  → 500   (0.05%) — attract volume
 *
 * Safety:
 *   - Oracle staleness check (6h): falls back to 0.3% if Sasha goes silent
 *   - Fee bounded in oracle: 50–10000 bips
 *   - Hook address permissions enforced by CREATE2 salt (deploy-xlayer-hook.js)
 *
 * IMPORTANT: Pool must be initialized with LPFeeLibrary.DYNAMIC_FEE_FLAG (0x800000)
 * as the fee parameter. See deploy-xlayer-hook.js.
 *
 * Sasha Coin — OKX Build X Hackathon 2026
 * X Layer (chainId 196) | PoolManager: 0x360e68faccca8ca495c1b759fd9eee466db9fb32
 */
contract SashaDynamicFeeHook is BaseOverrideFee {

    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice The oracle that stores Sasha's current market-risk fee
    address public immutable oracle;

    // Minimal oracle interface — avoids circular compile dependency
    ISashaOracle private immutable _oracle;

    // ─── Events ──────────────────────────────────────────────────────────────

    event SwapFeeApplied(uint24 fee, bool oracleStale);

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param _poolManager  Uniswap v4 PoolManager on X Layer
     *                      (0x360e68faccca8ca495c1b759fd9eee466db9fb32)
     * @param _oracleAddr   Deployed SashaOracle address
     */
    constructor(IPoolManager _poolManager, address _oracleAddr)
        BaseOverrideFee(_poolManager)
    {
        oracle  = _oracleAddr;
        _oracle = ISashaOracle(_oracleAddr);
    }

    // ─── Core hook logic ──────────────────────────────────────────────────────

    /**
     * @notice Returns the fee Sasha's AI signal dictates for this swap.
     *
     * BaseOverrideFee calls this in _beforeSwap() and ORs the result with
     * LPFeeLibrary.OVERRIDE_FEE_FLAG before returning to the PoolManager.
     *
     * If the oracle is stale (no update in 6h), falls back to 3000 (0.3%).
     * Sasha's signal is pushed autonomously every 6h by the VPS cron job.
     */
    function _getFee(
        address,            // sender — not used
        PoolKey calldata,   // key    — not used (single-pool hook)
        SwapParams calldata,// params — not used
        bytes calldata      // data   — not used
    )
        internal
        override
        returns (uint24 fee)
    {
        bool stale;
        fee   = _oracle.getFeeOrDefault();
        stale = _oracle.isStale();
        emit SwapFeeApplied(fee, stale);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /**
     * @notice Current fee that would be applied to the next swap.
     * @dev Useful for demo dashboards and the hackathon judge view.
     */
    function currentFee() external view returns (uint24) {
        return _oracle.getFeeOrDefault();
    }

    /**
     * @notice Human-readable risk label from the oracle.
     */
    function riskLevel() external view returns (string memory) {
        return ISashaOracle(oracle).riskLevel();
    }
}

// ─── Minimal oracle interface ─────────────────────────────────────────────────

interface ISashaOracle {
    function getFeeOrDefault() external view returns (uint24);
    function isStale()         external view returns (bool);
    function riskLevel()       external view returns (string memory);
    function currentFee()      external view returns (uint24);
    function updatedAt()       external view returns (uint256);
    function updateCount()     external view returns (uint256);
    function agent()           external view returns (address);
}
