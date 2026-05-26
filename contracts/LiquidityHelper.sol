// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * LiquidityHelper v2 — Single-use v4 liquidity provision helper
 *
 * Fixes v1: callerDelta is a packed BalanceDelta (int128 amount0 | int128 amount1).
 * Must unpack and settle each currency individually.
 * ERC20 settle flow: sync(currency) → transfer → settle()
 *
 * Sasha Coin — OKX Build X Hackathon 2026
 */

interface IPoolManager {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24  fee;
        int24   tickSpacing;
        address hooks;
    }
    struct ModifyLiquidityParams {
        int24   tickLower;
        int24   tickUpper;
        int256  liquidityDelta;
        bytes32 salt;
    }
    function unlock(bytes calldata data) external returns (bytes memory);
    function modifyLiquidity(
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external returns (int256 callerDelta, int256 feesAccrued);
    function sync(address currency) external;
    function settle() external payable returns (uint256 paid);
    function take(address currency, address to, uint256 amount) external;
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract LiquidityHelper {

    IPoolManager public immutable poolManager;
    address       public immutable owner;

    struct CallbackData {
        IPoolManager.PoolKey key;
        int24   tickLower;
        int24   tickUpper;
        uint128 liquidity;
        uint256 maxAmount0;
        uint256 maxAmount1;
        address refundTo;
    }

    event LiquidityAdded(bytes32 poolId, int24 tickLower, int24 tickUpper, int128 delta0, int128 delta1);

    constructor(address _poolManager) {
        poolManager = IPoolManager(_poolManager);
        owner       = msg.sender;
    }

    // ─── External entry ───────────────────────────────────────────────────────

    function addLiquidity(
        IPoolManager.PoolKey calldata key,
        int24   tickLower,
        int24   tickUpper,
        uint128 liquidity,
        uint256 maxAmount0,
        uint256 maxAmount1
    ) external {
        require(msg.sender == owner, "not owner");

        // Pull tokens from caller into this contract (max budgets)
        if (maxAmount0 > 0)
            IERC20(key.currency0).transferFrom(msg.sender, address(this), maxAmount0);
        if (maxAmount1 > 0)
            IERC20(key.currency1).transferFrom(msg.sender, address(this), maxAmount1);

        bytes memory cbData = abi.encode(CallbackData({
            key:        key,
            tickLower:  tickLower,
            tickUpper:  tickUpper,
            liquidity:  liquidity,
            maxAmount0: maxAmount0,
            maxAmount1: maxAmount1,
            refundTo:   msg.sender
        }));

        poolManager.unlock(cbData);
    }

    // ─── Unlock callback ─────────────────────────────────────────────────────

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "not pool manager");

        CallbackData memory d = abi.decode(rawData, (CallbackData));

        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower:      d.tickLower,
            tickUpper:      d.tickUpper,
            liquidityDelta: int256(uint256(d.liquidity)),
            salt:           bytes32(0)
        });

        (int256 packed,) = poolManager.modifyLiquidity(d.key, params, "");

        // Unpack BalanceDelta: high 128 bits = amount0, low 128 bits = amount1
        int128 delta0 = int128(packed >> 128);
        int128 delta1 = int128(packed);

        // Settle currencies we owe (negative delta = we must pay PM)
        // ERC20 flow: sync(currency) → transfer to PM → settle()
        if (delta0 < 0) {
            uint128 owed0 = uint128(-delta0);
            poolManager.sync(d.key.currency0);
            IERC20(d.key.currency0).transfer(address(poolManager), owed0);
            poolManager.settle();
        }
        if (delta1 < 0) {
            uint128 owed1 = uint128(-delta1);
            poolManager.sync(d.key.currency1);
            IERC20(d.key.currency1).transfer(address(poolManager), owed1);
            poolManager.settle();
        }

        // Take back what PM owes us (positive delta = PM pays us)
        if (delta0 > 0) poolManager.take(d.key.currency0, d.refundTo, uint128(delta0));
        if (delta1 > 0) poolManager.take(d.key.currency1, d.refundTo, uint128(delta1));

        // Refund any unused token budget back to caller
        uint256 left0 = IERC20(d.key.currency0).balanceOf(address(this));
        uint256 left1 = IERC20(d.key.currency1).balanceOf(address(this));
        if (left0 > 0) IERC20(d.key.currency0).transfer(d.refundTo, left0);
        if (left1 > 0) IERC20(d.key.currency1).transfer(d.refundTo, left1);

        emit LiquidityAdded(
            keccak256(abi.encode(d.key.currency0, d.key.currency1, d.key.fee, d.key.tickSpacing, d.key.hooks)),
            d.tickLower, d.tickUpper, delta0, delta1
        );

        return "";
    }

    // ─── Emergency rescue ─────────────────────────────────────────────────────

    function rescueToken(address token, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        IERC20(token).transfer(owner, amount);
    }
}
