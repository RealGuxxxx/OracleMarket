
#[allow(unused_field, duplicate_alias, unused_const)]
module oracle_marketplace::oracle_core;

use sui::object::{Self, UID, ID};
use sui::tx_context::{Self, TxContext};
use sui::url::{Self as url, Url};
use sui::transfer;
use std::string::{Self, String};
use std::option::{Self, Option};

public struct OracleQuery has key, store {
    id: UID,
    query_id: String, 
    query_type: String, 
    query_params: String, 
    provider: address, 
    result: Option<String>, 
    result_hash: Option<String>, 
    evidence_blob_id: Option<ID>, 
    evidence_url: Option<Url>, 
    creator: address, 
    created_at: u64, 
    updated_at: u64, 
    resolved: bool, 
}

public struct QueryCreatedEvent has copy, drop {
    query_id: String,
    query_type: String,
    provider: address,
    creator: address,
}

public struct QueryResolvedEvent has copy, drop {
    query_id: String,
    result: String,
    result_hash: String,
    provider: address,
}

const E_QUERY_NOT_FOUND: u64 = 1;
const E_QUERY_ALREADY_RESOLVED: u64 = 2;
const E_NOT_PROVIDER: u64 = 3;
const E_INVALID_DATA: u64 = 4;

entry fun create_query_entry(
    query_id: vector<u8>,
    query_type: vector<u8>,
    query_params: vector<u8>,
    provider: address,
    ctx: &mut TxContext
) {
    let query = create_query(query_id, query_type, query_params, provider, ctx);
    transfer::public_transfer(query, tx_context::sender(ctx));
}

public fun create_query(
    query_id: vector<u8>,
    query_type: vector<u8>,
    query_params: vector<u8>,
    provider: address,
    ctx: &mut TxContext
): OracleQuery {
    let query_id_str = string::utf8(query_id);
    let query_type_str = string::utf8(query_type);
    let query_params_str = string::utf8(query_params);
    
    OracleQuery {
        id: object::new(ctx),
        query_id: query_id_str,
        query_type: query_type_str,
        query_params: query_params_str,
        provider,
        result: option::none(),
        result_hash: option::none(),
        evidence_blob_id: option::none(),
        evidence_url: option::none(),
        creator: tx_context::sender(ctx),
        created_at: tx_context::epoch_timestamp_ms(ctx),
        updated_at: tx_context::epoch_timestamp_ms(ctx),
        resolved: false,
    }
}

entry fun resolve_query_entry(
    query: &mut OracleQuery,
    result: vector<u8>,
    result_hash: vector<u8>,
    evidence_url_bytes: vector<u8>,
    ctx: &mut TxContext
) {
    assert!(!query.resolved, E_QUERY_ALREADY_RESOLVED);
    assert!(tx_context::sender(ctx) == query.provider, E_NOT_PROVIDER);
    
    let result_str = if (vector::length(&result) == 0) {
        string::utf8(b"{}")
    } else {
        string::utf8(result)
    };
    
    let hash_str = if (vector::length(&result_hash) == 0) {
        string::utf8(b"")
    } else {
        string::utf8(result_hash)
    };
    
    let evidence_url = url::new_unsafe_from_bytes(evidence_url_bytes);
    
    query.result = option::some(result_str);
    query.result_hash = option::some(hash_str);
    query.evidence_url = option::some(evidence_url);
    query.resolved = true;
    query.updated_at = tx_context::epoch_timestamp_ms(ctx);
}

entry fun update_query_data(
    query: &mut OracleQuery,
    result: vector<u8>,
    result_hash: vector<u8>,
    evidence_url_bytes: vector<u8>,
    ctx: &mut TxContext
) {
    assert!(tx_context::sender(ctx) == query.provider, E_NOT_PROVIDER);
    
    let result_str = if (vector::length(&result) == 0) {
        string::utf8(b"{}")
    } else {
        string::utf8(result)
    };
    
    let hash_str = if (vector::length(&result_hash) == 0) {
        string::utf8(b"")
    } else {
        string::utf8(result_hash)
    };
    
    let evidence_url = url::new_unsafe_from_bytes(evidence_url_bytes);
    
    query.result = option::some(result_str);
    query.result_hash = option::some(hash_str);
    query.evidence_url = option::some(evidence_url);
    query.resolved = true; 
    query.updated_at = tx_context::epoch_timestamp_ms(ctx);
}

public fun get_result(query: &OracleQuery): Option<String> {
    query.result
}

public fun get_result_hash(query: &OracleQuery): Option<String> {
    query.result_hash
}

public fun get_evidence_url(query: &OracleQuery): Option<Url> {
    query.evidence_url
}

public fun is_resolved(query: &OracleQuery): bool {
    query.resolved
}

public fun get_query_id(query: &OracleQuery): String {
    query.query_id
}

public fun get_query_type(query: &OracleQuery): String {
    query.query_type
}

public fun get_query_params(query: &OracleQuery): String {
    query.query_params
}

public fun get_provider(query: &OracleQuery): address {
    query.provider
}

public fun transfer_query(query: OracleQuery, recipient: address) {
    transfer::public_transfer(query, recipient);
}
