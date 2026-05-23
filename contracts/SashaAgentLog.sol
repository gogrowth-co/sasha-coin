// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SashaAgentLog
 * @notice On-chain trade attestation log for Sasha — AI agent on Mantle.
 *
 * Every trade Sasha executes on Byreal/Solana is attested here:
 *   1. Sasha posts her thesis to X (timestamped, public, permanent)
 *   2. 60-second accountability window
 *   3. Trade executes on Byreal (Solana CLMM)
 *   4. Trade is attested here via logTrade()
 *
 * Owner is Sasha's Mantle EOA. Only the agent can write to this log.
 * All attestations are permanent, auditable, and linked to Solana TX hashes.
 * Gas cost per attestation is near-zero (event only, no storage writes except counter).
 *
 * Mantle Turing Test Hackathon 2026
 * Track: Agentic Wallets & Economy (Byreal-sponsored), Path B: RealClaw Real-Life
 */
contract SashaAgentLog is Ownable {

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TradeLogged(
        uint256 indexed agentId,
        string  action,
        string  solanaTx,
        string  rationale,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Total number of trades logged (public, readable by anyone)
    uint256 public tradeCount;

    /// @notice ERC-8004 agent identity NFT ID linked to this log
    uint256 public agentId;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _owner   Sasha's Mantle EOA — the only address that can log trades
     * @param _agentId ERC-8004 agent identity NFT ID
     */
    constructor(address _owner, uint256 _agentId) Ownable(_owner) {
        agentId = _agentId;
    }

    // -------------------------------------------------------------------------
    // Core attestation function
    // -------------------------------------------------------------------------

    /**
     * @notice Attest a trade execution on-chain.
     *
     * @param _agentId   Must match the stored agentId (prevents cross-agent replay)
     * @param action     Trade action: "OPEN_LP_POSITION" | "SWAP_TO_SOL" | "MOVE_TO_STABLE"
     * @param solanaTx   Solana transaction signature (base58)
     * @param rationale  Signal fusion rationale (social + onchain + Allora + Elfa + Polymarket)
     *
     * All parameters are calldata — stored in event logs only, not in contract storage.
     * This keeps attestation gas cost to ~21k + event encoding (~500-800 gwei on Mantle).
     */
    function logTrade(
        uint256 _agentId,
        string calldata action,
        string calldata solanaTx,
        string calldata rationale
    ) external onlyOwner {
        require(_agentId == agentId,          "SashaAgentLog: agentId mismatch");
        require(bytes(action).length > 0,     "SashaAgentLog: action required");

        tradeCount++;

        emit TradeLogged(
            _agentId,
            action,
            solanaTx,
            rationale,
            block.timestamp
        );
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    /// @notice Returns agent ID and total trade count in one call
    function agentStatus() external view returns (uint256 _agentId, uint256 _tradeCount) {
        return (agentId, tradeCount);
    }
}
