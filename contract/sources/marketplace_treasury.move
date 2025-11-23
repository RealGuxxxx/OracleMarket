/// Marketplace Treasury Module
/// Manages platform funds and collateral

#[allow(duplicate_alias, unused_use)]
module oracle_marketplace::marketplace_treasury;

use sui::object::{Self, UID, ID};
use sui::transfer;
use sui::coin::{Self, Coin};
use sui::balance::{Self, Balance};
use sui::sui::SUI;
use sui::tx_context::{Self, TxContext};
use sui::dynamic_field;
use std::option::{Self, Option};

/// Marketplace Treasury (shared object)
public struct MarketplaceTreasury has key {
    id: UID,
    platform_balance: Balance<SUI>, // Platform total funds
    admin: address, // Admin address
}

/// Admin Capability
public struct TreasuryAdminCap has key, store {
    id: UID,
    treasury_id: ID, // Treasury ID
}

/// Collateral Pool (uses dynamic_field to store collateral for each service)
public struct CollateralPool has key, store {
    id: UID,
    total_collateral: Balance<SUI>, // Total collateral amount
}

/// Error Codes
const E_NOT_ADMIN: u64 = 1;
const E_INSUFFICIENT_BALANCE: u64 = 2; // Insufficient balance
const E_COLLATERAL_NOT_FOUND: u64 = 3; // Collateral pool not found
const E_NOT_PROVIDER: u64 = 4; // Not provider

/// Create treasury (shared object)
public fun create_treasury(ctx: &mut TxContext): TreasuryAdminCap {
    let treasury_id = object::new(ctx);
    let admin = tx_context::sender(ctx);
    
    let treasury = MarketplaceTreasury {
        id: treasury_id,
        platform_balance: balance::zero<SUI>(),
        admin,
    };
    
    let treasury_object_id = object::id(&treasury);
    transfer::share_object(treasury);
    
    // Create admin capability
    TreasuryAdminCap {
        id: object::new(ctx),
        treasury_id: treasury_object_id,
    }
}

/// Deposit platform fee
public fun deposit_platform_fee(
    treasury: &mut MarketplaceTreasury,
    payment: Coin<SUI>,
) {
    let balance = coin::into_balance(payment);
    balance::join(&mut treasury.platform_balance, balance);
}

/// Withdraw platform funds (requires admin)
public fun withdraw_platform_funds(
    treasury: &mut MarketplaceTreasury,
    admin_cap: &TreasuryAdminCap,
    amount: u64,
    ctx: &mut TxContext
): Coin<SUI> {
    assert!(object::id(treasury) == admin_cap.treasury_id, E_NOT_ADMIN);
    assert!(tx_context::sender(ctx) == treasury.admin, E_NOT_ADMIN);
    assert!(balance::value(&treasury.platform_balance) >= amount, E_INSUFFICIENT_BALANCE);
    
    coin::take(&mut treasury.platform_balance, amount, ctx)
}

/// Get platform balance
public fun get_platform_balance(treasury: &MarketplaceTreasury): u64 {
    balance::value(&treasury.platform_balance)
}

/// Create collateral pool
public fun create_collateral_pool(ctx: &mut TxContext): CollateralPool {
    CollateralPool {
        id: object::new(ctx),
        total_collateral: balance::zero<SUI>(),
    }
}

/// Deposit collateral
public fun deposit_collateral(
    pool: &mut CollateralPool,
    service_id: ID,
    collateral: Coin<SUI>,
) {
    let balance = coin::into_balance(collateral);
    
    // Deposit to corresponding service's collateral pool
    if (dynamic_field::exists_<ID>(&pool.id, service_id)) {
        let existing = dynamic_field::borrow_mut<ID, Balance<SUI>>(&mut pool.id, service_id);
        balance::join(existing, balance);
    } else {
        dynamic_field::add<ID, Balance<SUI>>(&mut pool.id, service_id, balance);
    };
    
}

/// Withdraw collateral (only oracle_marketplace module can call)
public(package) fun withdraw_collateral(
    pool: &mut CollateralPool,
    service_id: ID,
    provider: address,
    amount: u64,
    ctx: &mut TxContext
): Coin<SUI> {
    assert!(dynamic_field::exists_<ID>(&pool.id, service_id), E_COLLATERAL_NOT_FOUND);
    
    // Verify caller is the service provider (permission check)
    assert!(tx_context::sender(ctx) == provider, E_NOT_PROVIDER);
    
    let collateral_balance = dynamic_field::borrow_mut<ID, Balance<SUI>>(&mut pool.id, service_id);
    let current_amount = balance::value(collateral_balance);
    assert!(current_amount >= amount, E_INSUFFICIENT_BALANCE);
    
    // Withdraw collateral (real withdrawal, funds taken from on-chain object)
    coin::take(collateral_balance, amount, ctx)
}

/// Get service collateral amount
public fun get_service_collateral(pool: &CollateralPool, service_id: ID): u64 {
    if (dynamic_field::exists_<ID>(&pool.id, service_id)) {
        let collateral = dynamic_field::borrow<ID, Balance<SUI>>(&pool.id, service_id);
        balance::value(collateral)
    } else {
        0
    }
}

/// Get total collateral amount (simplified: returns stored value)
public fun get_total_collateral(pool: &CollateralPool): u64 {
    balance::value(&pool.total_collateral)
}

/// Transfer admin capability
public fun transfer_admin_cap(
    admin_cap: TreasuryAdminCap,
    recipient: address,
) {
    transfer::public_transfer(admin_cap, recipient);
}

/// Transfer collateral pool ownership
public fun transfer_collateral_pool(
    pool: CollateralPool,
    recipient: address,
) {
    transfer::public_transfer(pool, recipient);
}

