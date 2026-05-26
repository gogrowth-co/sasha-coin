// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * SashaOracle — AI Signal Oracle for Sasha's Dynamic Fee Hook
 *
 * Sasha is an AI agent that posts to X daily, fuses 5 signal sources
 * (social sentiment, Byreal pool APR, Allora, Elfa, Polymarket) into a
 * market-risk reading, and pushes it here every 6 hours via an automated
 * off-chain script (push-signal-to-xlayer.js).
 *
 * The SashaDynamicFeeHook reads getFeeOrDefault() on every swap.
 *
 * Signal → Fee mapping:
 *   "risk-off"  → 10000  (1.0% — protect LPs during uncertainty)
 *   "neutral"   → 3000   (0.3% — standard market conditions)
 *   "risk-on"   → 500    (0.05% — attract volume when Sasha is confident)
 *
 * Safety:
 *   - Only Sasha's agent EOA can call setFee()
 *   - Fee is bounded between MIN_FEE and MAX_FEE
 *   - Staleness check: if no update in 6h, hook falls back to DEFAULT_FEE
 *
 * Sasha Coin — OKX Build X Hackathon 2026
 * X Layer (chainId 196)
 */
contract SashaOracle {

    // ─── Constants ───────────────────────────────────────────────────────────

    uint24 public constant DEFAULT_FEE = 3000;   // 0.3% — used when stale
    uint24 public constant MIN_FEE     = 50;     // 0.005% — floor
    uint24 public constant MAX_FEE     = 10000;  // 1.0%   — ceiling

    uint256 public constant STALENESS_THRESHOLD = 6 hours;

    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice Current fee in hundredths of a bip (same unit as Uniswap v4)
    uint24  public currentFee;

    /// @notice Human-readable risk label from the signal pipeline
    string  public riskLevel;

    /// @notice Timestamp of last fee update (block.timestamp)
    uint256 public updatedAt;

    /// @notice Total number of fee updates pushed by Sasha
    uint256 public updateCount;

    /// @notice Sasha's agent EOA — the only address allowed to call setFee()
    address public immutable agent;

    // ─── Events ──────────────────────────────────────────────────────────────

    event FeeUpdated(
        uint24  indexed oldFee,
        uint24  indexed newFee,
        string          riskLevel,
        uint256         timestamp,
        uint256         updateCount
    );

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotAgent(address caller);
    error FeeBelowMinimum(uint24 fee, uint24 min);
    error FeeAboveMaximum(uint24 fee, uint24 max);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _agent) {
        agent      = _agent;
        currentFee = DEFAULT_FEE;
        riskLevel  = "neutral";
        updatedAt  = block.timestamp;
    }

    // ─── Agent-only write ─────────────────────────────────────────────────────

    /**
     * @notice Push a new fee from Sasha's signal pipeline.
     * @param _fee       Fee in hundredths of a bip (e.g. 3000 = 0.3%)
     * @param _riskLevel Human-readable label: "risk-off" | "neutral" | "risk-on"
     *
     * Called automatically by scripts/push-signal-to-xlayer.js every 6 hours.
     */
    function setFee(uint24 _fee, string calldata _riskLevel) external {
        if (msg.sender != agent)   revert NotAgent(msg.sender);
        if (_fee < MIN_FEE)        revert FeeBelowMinimum(_fee, MIN_FEE);
        if (_fee > MAX_FEE)        revert FeeAboveMaximum(_fee, MAX_FEE);

        emit FeeUpdated(currentFee, _fee, _riskLevel, block.timestamp, updateCount + 1);

        currentFee  = _fee;
        riskLevel   = _riskLevel;
        updatedAt   = block.timestamp;
        updateCount++;
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the current fee, or DEFAULT_FEE if Sasha's signal is stale.
     * @dev Called by SashaDynamicFeeHook._getFee() on every swap.
     */
    function getFeeOrDefault() external view returns (uint24) {
        if (isStale()) return DEFAULT_FEE;
        return currentFee;
    }

    /**
     * @notice True if no update has been received in the last 6 hours.
     */
    function isStale() public view returns (bool) {
        return block.timestamp - updatedAt > STALENESS_THRESHOLD;
    }

    /**
     * @notice Full oracle state — useful for dashboards and demos.
     */
    function status() external view returns (
        uint24  fee,
        string memory risk,
        uint256 lastUpdate,
        uint256 count,
        bool    stale
    ) {
        return (currentFee, riskLevel, updatedAt, updateCount, isStale());
    }
}
