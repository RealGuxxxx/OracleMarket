/// Oracle Marketplace Module (Simplified Version)
/// Features:
/// 1. Service creation, pricing, and collateral management
/// 2. Service activation/pause
/// 3. Subscription management
/// 4. Query execution and recording
/// 5. Fee management

#[allow(unused_field, duplicate_alias, unused_const, unused_variable, lint(self_transfer))]
module oracle_marketplace::oracle_marketplace;

use sui::object::{Self, UID, ID};
use sui::tx_context::{Self, TxContext};
use sui::transfer;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::url::{Self as url, Url};
use sui::clock;
use std::string::{Self, String};
use std::option::{Self, Option};
use oracle_marketplace::marketplace_treasury;
use oracle_marketplace::oracle_core::{Self, OracleQuery};

/// Oracle Service
public struct OracleService has key, store {
    id: UID, 
    provider: address,
    name: String,
    service_type: String,
    description: String,
    price_per_query: u64,
    collateral: u64,
    total_queries: u64,
    successful_queries: u64,
    config_id: Option<String>,
    documentation_url: Option<Url>,
    active: bool,
    created_at: u64,
}

/// User Subscription
public struct Subscription has key, store {
    id: UID,
    subscriber: address,
    service_id: ID,
    start_time: u64,
    end_time: u64,
    active: bool,
    created_at: u64,
}

/// Query Record
public struct QueryRecord has key, store {
    id: UID,
    query_id: String,
    service_id: ID,
    requester: address,
    payment: u64,
    query_time: u64,
    success: bool,
}

/// Service Created Event
public struct ServiceCreatedEvent has copy, drop {
    service_id: ID,
    provider: address,
    service_type: String,
    price_per_query: u64,
}

/// Subscription Created Event
public struct SubscriptionCreatedEvent has copy, drop {
    subscription_id: ID,
    subscriber: address,
    service_id: ID,
    end_time: u64,
}

/// Query Event
public struct QueryEvent has copy, drop {
    query_id: String,
    service_id: ID,
    requester: address,
    payment: u64,
}

/// Error Codes
const E_SERVICE_NOT_FOUND: u64 = 1;
const E_SERVICE_INACTIVE: u64 = 2;
const E_INSUFFICIENT_PAYMENT: u64 = 3;
const E_INSUFFICIENT_COLLATERAL: u64 = 4;
const E_NOT_PROVIDER: u64 = 5;
const E_SUBSCRIPTION_EXPIRED: u64 = 6;
const E_INVALID_PRICE: u64 = 7;
const E_QUERY_NOT_RESOLVED: u64 = 8;
const E_SUBSCRIPTION_NOT_MATCH: u64 = 9;

/// Platform fee rate (basis points, 100 = 1%)
const PLATFORM_FEE_BPS: u64 = 300; // 3%

/// Minimum collateral (10,000,000 MIST = 0.01 SUI)
const MIN_COLLATERAL: u64 = 10000000;

/// Default subscription duration (30 days in milliseconds)
const DEFAULT_SUBSCRIPTION_DURATION: u64 = 30 * 24 * 60 * 60 * 1000;

// ============================================
// Service Management
// ============================================

/// Create oracle service (using collateral pool)
entry fun create_service_entry(
    name: vector<u8>,
    service_type: vector<u8>,
    description: vector<u8>,
    price_per_query: u64,
    collateral: Coin<SUI>,
    collateral_pool: &mut marketplace_treasury::CollateralPool,
    ctx: &mut TxContext
) {
    let service = create_service_with_pool(
        name,
        service_type,
        description,
        price_per_query,
        collateral,
        collateral_pool,
        option::none(),
        option::none(),
        ctx
    );
    transfer::public_transfer(service, tx_context::sender(ctx));
}

/// Create oracle service (simplified version, auto-shared, no collateral pool required)
#[allow(lint(public_entry))]
public entry fun create_service_simple(
    name: vector<u8>,
    service_type: vector<u8>,
    description: vector<u8>,
    price_per_query: u64,
    collateral: Coin<SUI>,
    ctx: &mut TxContext
) {
    assert!(price_per_query > 0, E_INVALID_PRICE);
    let collateral_amount = coin::value(&collateral);
    assert!(collateral_amount >= MIN_COLLATERAL, E_INSUFFICIENT_COLLATERAL);
    
    // Create service object
    let service = OracleService {
        id: object::new(ctx),
        provider: tx_context::sender(ctx),
        name: string::utf8(name),
        service_type: string::utf8(service_type),
        description: string::utf8(description),
        price_per_query,
        collateral: collateral_amount,
        total_queries: 0,
        successful_queries: 0,
        config_id: option::none(),
        documentation_url: option::none(),
        active: true,
        created_at: tx_context::epoch_timestamp_ms(ctx),
    };
    
    // Return collateral to creator (simplified version, not locked)
    // Note: Real collateral requires using create_service_entry with collateral pool
    transfer::public_transfer(collateral, tx_context::sender(ctx));
    
    // Share service object to make it accessible to other users
    transfer::share_object(service);
}

/// Create oracle service (using collateral pool)
public fun create_service_with_pool(
    name: vector<u8>,
    service_type: vector<u8>,
    description: vector<u8>,
    price_per_query: u64,
    collateral: Coin<SUI>,
    collateral_pool: &mut marketplace_treasury::CollateralPool,
    config_id: Option<String>,
    documentation_url: Option<Url>,
    ctx: &mut TxContext
): OracleService {
    assert!(price_per_query > 0, E_INVALID_PRICE);
    let collateral_amount = coin::value(&collateral);
    assert!(collateral_amount >= MIN_COLLATERAL, E_INSUFFICIENT_COLLATERAL);
    
    let service = OracleService {
        id: object::new(ctx),
        provider: tx_context::sender(ctx),
        name: string::utf8(name),
        service_type: string::utf8(service_type),
        description: string::utf8(description),
        price_per_query,
        collateral: collateral_amount,
        total_queries: 0,
        successful_queries: 0,
        config_id,
        documentation_url,
        active: true,
        created_at: tx_context::epoch_timestamp_ms(ctx),
    };
    
    // Deposit collateral to pool (real collateral, funds are locked)
    let service_id = object::id(&service);
    marketplace_treasury::deposit_collateral(collateral_pool, service_id, collateral);
    
    service
}

/// Withdraw collateral (entry function, only service provider can withdraw)
entry fun withdraw_collateral_entry(
    service: &OracleService,
    pool: &mut marketplace_treasury::CollateralPool,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext
) {
    assert!(tx_context::sender(ctx) == service.provider, E_NOT_PROVIDER);
    
    let service_id = object::id(service);
    let coin = marketplace_treasury::withdraw_collateral(
        pool,
        service_id,
        service.provider,
        amount,
        ctx
    );
    transfer::public_transfer(coin, recipient);
}

/// Update service price
entry fun update_price_entry(
    service: &mut OracleService,
    new_price: u64,
    ctx: &TxContext,
) {
    assert!(tx_context::sender(ctx) == service.provider, E_NOT_PROVIDER);
    assert!(new_price > 0, E_INVALID_PRICE);
    service.price_per_query = new_price;
}

/// Activate/deactivate service
entry fun set_active_entry(
    service: &mut OracleService,
    active: bool,
    ctx: &TxContext,
) {
    assert!(tx_context::sender(ctx) == service.provider, E_NOT_PROVIDER);
    service.active = active;
}

/// Update service config ID (for publisher to update via API Key)
entry fun update_config_id_entry(
    service: &mut OracleService,
    config_id: vector<u8>,
    ctx: &TxContext,
) {
    assert!(tx_context::sender(ctx) == service.provider, E_NOT_PROVIDER);
    service.config_id = option::some(string::utf8(config_id));
}

/// Update service documentation URL (for publisher to update via API Key)
entry fun update_documentation_url_entry(
    service: &mut OracleService,
    documentation_url: vector<u8>,
    ctx: &TxContext,
) {
    assert!(tx_context::sender(ctx) == service.provider, E_NOT_PROVIDER);
    let url_obj = url::new_unsafe_from_bytes(documentation_url);
    service.documentation_url = option::some(url_obj);
}

// ============================================
// Subscription Management
// ============================================

/// Create subscription (entry function)
entry fun create_subscription_entry(
    service: &OracleService,
    ctx: &mut TxContext
) {
    let subscription = create_subscription(service, ctx);
    transfer::public_transfer(subscription, tx_context::sender(ctx));
}

/// Create subscription (30-day validity)
public fun create_subscription(
    service: &OracleService,
    ctx: &mut TxContext
): Subscription {
    assert!(service.active, E_SERVICE_INACTIVE);
    
    let start_time = tx_context::epoch_timestamp_ms(ctx);
    let end_time = start_time + DEFAULT_SUBSCRIPTION_DURATION;
    
    Subscription {
        id: object::new(ctx),
        subscriber: tx_context::sender(ctx),
        service_id: object::id(service),
        start_time,
        end_time,
        active: true,
        created_at: start_time,
    }
}

/// Check if subscription is valid
public fun is_subscription_valid(subscription: &Subscription, current_time: u64): bool {
    subscription.active && current_time <= subscription.end_time
}

// ============================================
// Query Execution
// ============================================

/// On-chain query oracle service (for smart contracts to call)
/// 
/// Features:
/// 1. Verify subscription
/// 2. Pay-per-query
/// 3. Record query
/// 4. Return result
public fun query_oracle_sync(
    service: &mut OracleService,
    subscription: &Subscription,
    query: &OracleQuery,
    payment: &mut Coin<SUI>,
    treasury: &mut marketplace_treasury::MarketplaceTreasury,
    clock: &clock::Clock,
    ctx: &mut TxContext
): OracleQueryResult {
    // 1. Verify service is active
    assert!(service.active, E_SERVICE_INACTIVE);
    
    // 2. Verify subscription permissions
    assert!(subscription.active, E_SUBSCRIPTION_EXPIRED);
    let current_time = clock::timestamp_ms(clock);
    assert!(current_time <= subscription.end_time, E_SUBSCRIPTION_EXPIRED);
    assert!(subscription.service_id == object::id(service), E_SUBSCRIPTION_NOT_MATCH);
    assert!(tx_context::sender(ctx) == subscription.subscriber, E_SUBSCRIPTION_EXPIRED);
    
    // 3. Verify payment
    let payment_amount = coin::value(payment);
    assert!(payment_amount >= service.price_per_query, E_INSUFFICIENT_PAYMENT);
    
    // 4. Verify query is resolved
    assert!(oracle_core::is_resolved(query), E_QUERY_NOT_RESOLVED);
    
    // 5. Extract payment and distribute
    let fee = service.price_per_query;
    let mut fee_coin = coin::split(payment, fee, ctx);
    
    // Calculate fee distribution
    let platform_fee = fee * PLATFORM_FEE_BPS / 10000;
    let provider_fee = fee - platform_fee;
    
    // Extract platform fee
    let platform_coin = coin::split(&mut fee_coin, platform_fee, ctx);
    marketplace_treasury::deposit_platform_fee(treasury, platform_coin);
    
    // Remaining goes to provider
    transfer::public_transfer(fee_coin, service.provider);
    
    // 6. Update service statistics
    service.total_queries = service.total_queries + 1;
    service.successful_queries = service.successful_queries + 1;
    
    // 7. Create query record
    let query_record = QueryRecord {
        id: object::new(ctx),
        query_id: oracle_core::get_query_id(query),
        service_id: object::id(service),
        requester: subscription.subscriber,
        payment: fee,
        query_time: current_time,
        success: true,
    };
    transfer::public_transfer(query_record, subscription.subscriber);
    
    // 8. Get query result
    let result_option = oracle_core::get_result(query);
    let result_hash_option = oracle_core::get_result_hash(query);
    
    let result_str = if (option::is_some(&result_option)) {
        *option::borrow(&result_option)
    } else {
        string::utf8(b"{}")
    };
    
    let result_hash_str = if (option::is_some(&result_hash_option)) {
        *option::borrow(&result_hash_option)
    } else {
        string::utf8(b"")
    };
    
    // 9. Return query result
    OracleQueryResult {
        query_id: oracle_core::get_query_id(query),
        result: result_str,
        result_hash: result_hash_str,
        query_time: current_time,
    }
}

/// Oracle query result (for smart contracts to use)
public struct OracleQueryResult has copy, drop {
    query_id: String,
    result: String,
    result_hash: String,
    query_time: u64,
}

// ============================================
// Query Functions
// ============================================

/// Get service price
public fun get_price(service: &OracleService): u64 {
    service.price_per_query
}

/// Check if service is active
public fun is_active(service: &OracleService): bool {
    service.active
}

/// Get service provider
public fun get_provider(service: &OracleService): address {
    service.provider
}

/// Get query ID from query result
public fun get_query_id(result: &OracleQueryResult): String {
    result.query_id
}

/// Get query result data
public fun get_result_data(result: &OracleQueryResult): String {
    result.result
}

/// Get query result hash
public fun get_result_hash_value(result: &OracleQueryResult): String {
    result.result_hash
}

/// Get query time
public fun get_query_time(result: &OracleQueryResult): u64 {
    result.query_time
}