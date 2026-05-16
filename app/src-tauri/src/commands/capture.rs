use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Pool, Sqlite};
use tauri::AppHandle;

use crate::db::ledger;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseTransactionMessageRequest {
    pub message: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ParsePreviewResponse {
    pub raw_text: String,
    pub normalized_text: String,
    pub amount_minor: Option<i64>,
    pub direction: Option<String>,
    pub transaction_date: Option<String>,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub merchant_or_payee: Option<String>,
    pub readiness_state: &'static str,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAccountContext {
    pub account_id: i64,
    pub bank_name: String,
    pub account_number: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AccountMismatchResolution {
    UseSelectedAccount,
    UseParsedAccount,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DuplicateDecision {
    SaveAsNew,
    SkipSave,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTransactionParsedPayload {
    pub raw_text: String,
    pub normalized_text: String,
    pub amount_minor: Option<i64>,
    pub direction: Option<String>,
    pub transaction_date: Option<String>,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub merchant_or_payee: Option<String>,
    pub readiness_state: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTransactionAttemptRequest {
    pub account_context: SaveAccountContext,
    pub parsed_payload: SaveTransactionParsedPayload,
    pub mismatch_resolution: Option<AccountMismatchResolution>,
    pub duplicate_decision: Option<DuplicateDecision>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockedFieldIssue {
    pub field: &'static str,
    pub reason: &'static str,
    pub hint: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountMismatchSignal {
    pub detected: bool,
    pub requires_resolution: bool,
    pub parsed_bank_name: Option<String>,
    pub parsed_account_number: Option<String>,
    pub selected_bank_name: String,
    pub selected_account_number: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateCandidateSignal {
    pub detected: bool,
    pub requires_decision: bool,
    pub reason: Option<String>,
    pub fingerprint: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTransactionAttemptResponse {
    pub validation_state: &'static str,
    pub accepted_for_write: bool,
    pub checked_fields: Vec<&'static str>,
    pub message: &'static str,
}

const VALIDATION_REQUIRED_FIELDS: [&str; 6] = [
    "amountMinor",
    "direction",
    "transactionDate",
    "bankName",
    "accountNumber",
    "merchantOrPayee",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MessageFamily {
    BalanceAlert,
    ChequeEvent,
    AtmDebit,
    CardSpend,
    UpiOrTransfer,
    AccountCreditOrDebit,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEnvelope {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandEnvelope<T>
where
    T: Serialize,
{
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorEnvelope>,
}

#[tauri::command]
pub async fn parse_transaction_message(
    _app: AppHandle,
    payload: ParseTransactionMessageRequest,
) -> CommandEnvelope<ParsePreviewResponse> {
    parse_preview_envelope(&payload.message)
}

#[tauri::command]
pub async fn attempt_transaction_save(
    app: AppHandle,
    payload: SaveTransactionAttemptRequest,
) -> CommandEnvelope<SaveTransactionAttemptResponse> {
    match ledger::sqlite_pool(&app).await {
        Ok(pool) => attempt_transaction_save_with_pool(&pool, payload).await,
        Err(error) => persistence_error_envelope(error),
    }
}

async fn attempt_transaction_save_with_pool(
    pool: &Pool<Sqlite>,
    payload: SaveTransactionAttemptRequest,
) -> CommandEnvelope<SaveTransactionAttemptResponse> {
    let transaction = match pool.begin().await {
        Ok(tx) => tx,
        Err(error) => return persistence_error_envelope(error.to_string()),
    };

    if let Some(command_error) = validate_save_request(&payload) {
        let _ = transaction.rollback().await;
        return command_error;
    }

    let _ = transaction.rollback().await;

    CommandEnvelope {
        ok: true,
        data: Some(SaveTransactionAttemptResponse {
            validation_state: "passed",
            accepted_for_write: false,
            checked_fields: VALIDATION_REQUIRED_FIELDS.to_vec(),
            message: "Validation passed. Persistence is deferred in this story scope.",
        }),
        error: None,
    }
}

fn validate_save_request(
    payload: &SaveTransactionAttemptRequest,
) -> Option<CommandEnvelope<SaveTransactionAttemptResponse>> {
    let mut blocked_fields: Vec<BlockedFieldIssue> = Vec::new();

    if payload.account_context.account_id <= 0 {
        blocked_fields.push(BlockedFieldIssue {
            field: "accountNumber",
            reason: "ambiguous",
            hint: "Open the existing account workspace before attempting save.",
        });
    }

    if payload.account_context.bank_name.trim().is_empty() {
        blocked_fields.push(BlockedFieldIssue {
            field: "bankName",
            reason: "missing",
            hint: "Select a ledger account with a known bank name.",
        });
    }

    if payload.account_context.account_number.trim().is_empty() {
        blocked_fields.push(BlockedFieldIssue {
            field: "accountNumber",
            reason: "missing",
            hint: "Select a ledger account with a known account number.",
        });
    }

    let parsed = &payload.parsed_payload;
    let _ = (&parsed.raw_text, &parsed.normalized_text, &parsed.readiness_state);

    match parsed.amount_minor {
        None => blocked_fields.push(BlockedFieldIssue {
            field: "amountMinor",
            reason: "missing",
            hint: "Provide the transaction amount from the source bank message.",
        }),
        Some(value) if value <= 0 => blocked_fields.push(BlockedFieldIssue {
            field: "amountMinor",
            reason: "ambiguous",
            hint: "Use a positive amount in minor units (paise).",
        }),
        Some(_) => {}
    }

    match parsed.direction.as_deref() {
        None => blocked_fields.push(BlockedFieldIssue {
            field: "direction",
            reason: "missing",
            hint: "Specify whether the transaction is debit or credit.",
        }),
        Some("debit") | Some("credit") => {}
        Some(_) => blocked_fields.push(BlockedFieldIssue {
            field: "direction",
            reason: "ambiguous",
            hint: "Use only debit or credit.",
        }),
    }

    match parsed.transaction_date.as_deref() {
        None => blocked_fields.push(BlockedFieldIssue {
            field: "transactionDate",
            reason: "missing",
            hint: "Provide the transaction date in YYYY-MM-DD format.",
        }),
        Some(date) if !is_yyyy_mm_dd(date) => blocked_fields.push(BlockedFieldIssue {
            field: "transactionDate",
            reason: "ambiguous",
            hint: "Use an unambiguous date in YYYY-MM-DD format.",
        }),
        Some(_) => {}
    }

    validate_required_text_field(parsed.bank_name.as_deref(), "bankName", &mut blocked_fields);
    validate_required_text_field(
        parsed.account_number.as_deref(),
        "accountNumber",
        &mut blocked_fields,
    );
    validate_required_text_field(
        parsed.merchant_or_payee.as_deref(),
        "merchantOrPayee",
        &mut blocked_fields,
    );

    let account_mismatch_signal = detect_account_mismatch_signal(payload);
    let duplicate_candidate_signal = detect_duplicate_candidate_signal(parsed);

    if account_mismatch_signal.detected && payload.mismatch_resolution.is_none() {
        blocked_fields.push(BlockedFieldIssue {
            field: "accountNumber",
            reason: "ambiguous",
            hint: "Account mismatch detected. Choose a mismatch resolution before retrying save.",
        });
    }

    if duplicate_candidate_signal.detected && payload.duplicate_decision.is_none() {
        blocked_fields.push(BlockedFieldIssue {
            field: "merchantOrPayee",
            reason: "ambiguous",
            hint: "Possible duplicate detected. Choose a duplicate decision before retrying save.",
        });
    }

    if blocked_fields.is_empty() {
        return None;
    }

    Some(CommandEnvelope {
        ok: false,
        data: None,
        error: Some(ErrorEnvelope {
            code: "VALIDATION_FAILED",
            message: "Critical fields are missing or ambiguous. Save is blocked.".to_string(),
            hint: Some("Review each field and re-parse or correct values before saving.".to_string()),
            details: Some(json!({
                "blockedFields": blocked_fields,
                "nextAction": "Fix the listed fields and retry save.",
                "accountMismatch": account_mismatch_signal,
                "duplicateCandidate": duplicate_candidate_signal,
            })),
        }),
    })
}

fn detect_account_mismatch_signal(payload: &SaveTransactionAttemptRequest) -> AccountMismatchSignal {
    let parsed_bank = payload.parsed_payload.bank_name.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty());
    let parsed_account = payload
        .parsed_payload
        .account_number
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty());

    let selected_bank_norm = normalize_compare_text(&payload.account_context.bank_name);
    let selected_account_norm = normalize_compare_text(&payload.account_context.account_number);
    let parsed_bank_norm = parsed_bank.map(normalize_compare_text);
    let parsed_account_norm = parsed_account.map(normalize_compare_text);

    let bank_mismatch = parsed_bank_norm
        .as_deref()
        .map(|value| value != selected_bank_norm)
        .unwrap_or(false);
    let account_mismatch = parsed_account_norm
        .as_deref()
        .map(|value| value != selected_account_norm)
        .unwrap_or(false);
    let detected = bank_mismatch || account_mismatch;

    AccountMismatchSignal {
        detected,
        requires_resolution: detected,
        parsed_bank_name: parsed_bank.map(|value| value.to_string()),
        parsed_account_number: parsed_account.map(|value| value.to_string()),
        selected_bank_name: payload.account_context.bank_name.clone(),
        selected_account_number: payload.account_context.account_number.clone(),
    }
}

fn detect_duplicate_candidate_signal(parsed: &SaveTransactionParsedPayload) -> DuplicateCandidateSignal {
    let normalized = parsed.normalized_text.to_ascii_lowercase();
    let markers = [
        "duplicate",
        "already processed",
        "already paid",
        "already done",
        "repeat transaction",
    ];
    let detected = markers.iter().any(|marker| normalized.contains(marker));

    let fingerprint = format!(
        "{}|{}|{}|{}|{}",
        parsed.amount_minor.unwrap_or_default(),
        parsed.direction.as_deref().unwrap_or("unknown"),
        parsed.transaction_date.as_deref().unwrap_or("unknown"),
        normalize_compare_text(parsed.account_number.as_deref().unwrap_or("unknown")),
        normalize_compare_text(parsed.merchant_or_payee.as_deref().unwrap_or("unknown")),
    );

    DuplicateCandidateSignal {
        detected,
        requires_decision: detected,
        reason: if detected {
            Some("Message contains duplicate marker text.".to_string())
        } else {
            None
        },
        fingerprint,
    }
}

fn normalize_compare_text(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .map(|ch| ch.to_ascii_uppercase())
        .collect()
}

fn validate_required_text_field(
    value: Option<&str>,
    field: &'static str,
    blocked_fields: &mut Vec<BlockedFieldIssue>,
) {
    match value.map(str::trim) {
        None | Some("") => blocked_fields.push(BlockedFieldIssue {
            field,
            reason: "missing",
            hint: required_field_hint(field),
        }),
        Some(text) if is_ambiguous_text(text) => blocked_fields.push(BlockedFieldIssue {
            field,
            reason: "ambiguous",
            hint: ambiguous_field_hint(field),
        }),
        Some(_) => {}
    }
}

fn required_field_hint(field: &str) -> &'static str {
    match field {
        "bankName" => "Provide the originating bank name from the message.",
        "accountNumber" => "Provide the masked account/card identifier from the message.",
        "merchantOrPayee" => "Provide the merchant or payee name exactly as shown.",
        _ => "Provide a valid field value from the source message.",
    }
}

fn ambiguous_field_hint(field: &str) -> &'static str {
    match field {
        "bankName" => "Replace placeholder bank text with the exact bank name.",
        "accountNumber" => "Replace placeholder account text with the exact account identifier.",
        "merchantOrPayee" => "Replace placeholder merchant/payee text with an explicit value.",
        _ => "Replace ambiguous field text with a concrete value.",
    }
}

fn is_ambiguous_text(value: &str) -> bool {
    let lowered = value.trim().to_ascii_lowercase();

    if lowered.is_empty() {
        return true;
    }

    let exact = ["unknown", "ambiguous", "n/a", "na", "tbd", "-", "--"];
    if exact.contains(&lowered.as_str()) {
        return true;
    }

    lowered
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .any(|token| matches!(token, "unknown" | "ambiguous"))
}

fn persistence_error_envelope<T>(message: String) -> CommandEnvelope<T>
where
    T: Serialize,
{
    CommandEnvelope {
        ok: false,
        data: None,
        error: Some(ErrorEnvelope {
            code: "PERSISTENCE_ERROR",
            message,
            hint: Some("Retry after restarting the app. If the problem persists, inspect local database availability.".to_string()),
            details: None,
        }),
    }
}

fn parse_preview_envelope(
    message: &str,
) -> CommandEnvelope<ParsePreviewResponse> {
    let parsed = parse_preview(message);

    match parsed {
        Some(data) => CommandEnvelope {
            ok: true,
            data: Some(data),
            error: None,
        },
        None => CommandEnvelope {
            ok: false,
            data: None,
            error: Some(ErrorEnvelope {
                code: "PARSE_FAILED",
                message: "The pasted message format is not supported for safe parsing.".to_string(),
                hint: Some(
                    "Paste the complete bank SMS/email text including amount, direction, and date."
                        .to_string(),
                ),
                details: Some(json!({
                    "readinessState": "parse-failed",
                    "action": "Review message format and retry paste."
                })),
            }),
        },
    }
}

fn parse_preview(raw_text: &str) -> Option<ParsePreviewResponse> {
    let normalized = normalize_whitespace(raw_text);
    if normalized.is_empty() {
        return None;
    }
    let lowered = normalized.to_lowercase();

    // Phase 1: classify first, but keep legacy extraction behavior unchanged.
    let _message_family = classify_message_family(&normalized);

    // Phase 4: downgrade non-transaction alerts that only describe thresholds/config/state.
    if is_non_transaction_alert(&lowered) && !has_strong_transaction_signal(&lowered) {
        return None;
    }

    let amount_minor = extract_amount_minor(&normalized);
    let direction = extract_direction_by_family(&normalized, _message_family)
        .or_else(|| extract_direction(&normalized));
    let transaction_date = extract_date(&normalized);
    let bank_name = extract_bank_name(&normalized);
    let account_number = extract_account_number_by_family(&normalized, _message_family)
        .or_else(|| extract_account_number(&normalized));
    let merchant_or_payee = extract_merchant_or_payee_by_family(&normalized, _message_family)
        .or_else(|| extract_merchant_or_payee(&normalized));

    if amount_minor.is_none() || direction.is_none() {
        return None;
    }

    if transaction_date.is_none() && !is_salary_credit_without_date(&normalized, direction.as_deref()) {
        return None;
    }

    let readiness_state = if amount_minor.is_some()
        && direction.is_some()
        && transaction_date.is_some()
        && bank_name.is_some()
        && account_number.is_some()
        && merchant_or_payee.is_some()
    {
        "ready"
    } else {
        "needs-review"
    };

    Some(ParsePreviewResponse {
        raw_text: raw_text.to_string(),
        normalized_text: normalized,
        amount_minor,
        direction,
        transaction_date,
        bank_name,
        account_number,
        merchant_or_payee,
        readiness_state,
    })
}

fn is_salary_credit_without_date(message: &str, direction: Option<&str>) -> bool {
    direction == Some("credit") && message.to_lowercase().contains("salary")
}

fn normalize_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn classify_message_family(message: &str) -> MessageFamily {
    let lowered = message.to_lowercase();

    if contains_any(
        &lowered,
        &[
            "balance",
            "falls below",
            "rises above",
            "available balance",
            "clear bal",
            "threshold alert",
            "balance threshold",
        ],
    ) {
        return MessageFamily::BalanceAlert;
    }

    if contains_any(&lowered, &["cheque", "dishonour", "dishonor", "return"]) {
        return MessageFamily::ChequeEvent;
    }

    if contains_any(&lowered, &["atm", "cash withdrawal", "cash withdrawn"]) {
        return MessageFamily::AtmDebit;
    }

    if contains_any(&lowered, &["pos", "swiped", "purchase", "spent", "card used", "credit card", "debit card"]) {
        return MessageFamily::CardSpend;
    }

    if contains_any(&lowered, &["upi", "vpa", "collect", "beneficiary"]) {
        return MessageFamily::UpiOrTransfer;
    }

    MessageFamily::AccountCreditOrDebit
}

fn contains_any(message: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| message.contains(needle))
}

fn has_strong_transaction_signal(message: &str) -> bool {
    contains_any(
        message,
        &[
            "debited",
            "credited",
            "spent",
            "purchase",
            "swiped",
            "sent",
            "received",
            "withdrawn",
            "cash withdrawal",
            "trxn",
            "txn",
        ],
    )
}

fn is_non_transaction_alert(message: &str) -> bool {
    contains_any(
        message,
        &[
            "threshold alert",
            "alert set",
            "limit set",
            "available balance is",
            "falls below",
            "rises above",
            "balance below",
            "balance above",
            "cheque book issue alert",
        ],
    )
}

fn extract_direction_by_family(message: &str, family: MessageFamily) -> Option<String> {
    let lowered = message.to_lowercase();

    match family {
        MessageFamily::AtmDebit => {
            if contains_any(&lowered, &["cash withdrawal", "cash withdrawn", "atm withdrawal", "withdrawn"]) {
                return Some("debit".to_string());
            }
            if contains_any(&lowered, &["reversal", "reversed", "refund", "credited"]) {
                return Some("credit".to_string());
            }
        }
        MessageFamily::CardSpend => {
            if contains_any(&lowered, &["spent", "purchase", "swiped", "card used", "used for purchase"]) {
                return Some("debit".to_string());
            }
            if contains_any(&lowered, &["refund", "reversal", "reversed", "credited", "received"]) {
                return Some("credit".to_string());
            }
        }
        MessageFamily::UpiOrTransfer => {
            if contains_any(&lowered, &["credited", "received", "collect received"]) {
                return Some("credit".to_string());
            }
            if contains_any(&lowered, &["sent", "debited", "debit", "dr", "collect"]) {
                return Some("debit".to_string());
            }
        }
        MessageFamily::BalanceAlert | MessageFamily::ChequeEvent | MessageFamily::AccountCreditOrDebit => {}
    }

    None
}

fn extract_account_number_by_family(message: &str, family: MessageFamily) -> Option<String> {
    if family != MessageFamily::CardSpend {
        return None;
    }

    let tokens: Vec<_> = message.split_whitespace().collect();

    for idx in 0..tokens.len() {
        let marker = clean_token(tokens[idx]).to_lowercase();
        if ["cardno", "cardnumber", "cardnum", "card#"].contains(&marker.as_str()) && idx + 1 < tokens.len() {
            let candidate = normalize_account_token(tokens[idx + 1]);
            if candidate.len() >= 4 && candidate.len() <= 16 && candidate.chars().any(|ch| ch.is_ascii_digit()) {
                if candidate.len() <= 5 {
                    return Some(format!("Card {}", candidate));
                }
                return Some(candidate);
            }
        }
    }

    None
}

fn extract_merchant_or_payee_by_family(message: &str, family: MessageFamily) -> Option<String> {
    let tokens: Vec<_> = message.split_whitespace().collect();

    match family {
        MessageFamily::CardSpend => {
            for idx in 0..tokens.len() {
                let marker = clean_token(tokens[idx]).to_lowercase();
                if marker == "merchant" {
                    let mut collected = Vec::new();
                    let mut scan_idx = idx + 1;
                    let stopwords = [
                        "on", "ref", "trxn", "txn", "avl", "bal", "clear", "value", "is", "a/c", "ac",
                        "account", "bank", "via", "using", "the", "your", "my", "an", "a", "upi",
                    ];

                    while scan_idx < tokens.len() && collected.len() < 3 {
                        let token = clean_token(tokens[scan_idx]);
                        let lowered = token.to_lowercase();
                        if token.is_empty() || stopwords.contains(&lowered.as_str()) {
                            break;
                        }
                        collected.push(token);
                        scan_idx += 1;
                    }

                    if !collected.is_empty() {
                        return Some(collected.join(" "));
                    }
                }
            }
        }
        MessageFamily::UpiOrTransfer => {
            for idx in 0..tokens.len() {
                let marker = clean_token(tokens[idx]).to_lowercase();
                if marker == "beneficiary" && idx + 1 < tokens.len() {
                    let candidate = clean_token(tokens[idx + 1]);
                    if !candidate.is_empty() {
                        return Some(candidate);
                    }
                }
            }
        }
        MessageFamily::BalanceAlert
        | MessageFamily::ChequeEvent
        | MessageFamily::AtmDebit
        | MessageFamily::AccountCreditOrDebit => {}
    }

    None
}

fn extract_direction(message: &str) -> Option<String> {
    let lowered = message.to_lowercase();
    let tokens: Vec<&str> = lowered.split_whitespace().collect();

    let debit_keywords = ["debited", "debit", "withdrawn", "spent", "sent", "dr"];
    let credit_keywords = ["credited", "credit", "received", "cr"];

    for token in &tokens {
        let clean = clean_token(token);
        if debit_keywords.contains(&clean.as_str()) {
            return Some("debit".to_string());
        }
        if credit_keywords.contains(&clean.as_str()) {
            return Some("credit".to_string());
        }
    }

    None
}

fn extract_date(message: &str) -> Option<String> {

    for token in message.split_whitespace() {
        let cleaned = clean_token(token);
        
        // Handle timestamps: strip everything after the date portion
        // e.g., "2026-05-06:09:55:03" -> "2026-05-06"
        let date_only = if cleaned.contains(':') {
            let colon_idx = cleaned.find(':').unwrap();
            &cleaned[..colon_idx]
        } else {
            &cleaned
        };
        
        if is_yyyy_mm_dd(date_only) {
            return Some(date_only.to_string());
        }
        if is_dd_mm_yyyy(date_only) {
            return Some(normalize_date_to_yyyy_mm_dd(date_only));
        }
        if is_dd_mm_yy(date_only) {
            return Some(normalize_date_to_yyyy_mm_dd(date_only));
        }
        if is_dd_mmm_yyyy(date_only) {
            return Some(normalize_date_mmm_to_yyyy_mm_dd(date_only));
        }
        if is_dd_mm_yy_dash(date_only) {
            return Some(normalize_date_dash_to_yyyy_mm_dd(date_only));
        }
    }

    None
}
fn extract_bank_name(message: &str) -> Option<String> {
    let tokens: Vec<_> = message.split_whitespace().collect();
    let known_banks = ["hdfc", "icici", "sbi", "axis", "kotak", "yes", "boi", "union", "indian", "state", "federal", "idbi", "hsbc", "standard", "bank"];

    for idx in 0..tokens.len() {
        let current = clean_token(tokens[idx]).to_lowercase();

        if current != "bank"
            && known_banks.contains(&current.as_str())
            && idx + 2 < tokens.len()
            && clean_token(tokens[idx + 1]).eq_ignore_ascii_case("credit")
            && clean_token(tokens[idx + 2]).eq_ignore_ascii_case("card")
        {
            return Some(format!("{} Bank", uppercase_first(&clean_token(tokens[idx]))));
        }

        let current = clean_token(tokens[idx]).to_lowercase();
        if current == "bank" && idx > 0 {
            let prefix = clean_token(tokens[idx - 1]);
            if !prefix.is_empty() && (known_banks.contains(&prefix.to_lowercase().as_str()) || prefix.chars().all(|c| c.is_ascii_uppercase() || !c.is_ascii_alphabetic())) {
                return Some(format!("{} Bank", uppercase_first(&prefix)));
            }
        }
    }

    None
}

fn extract_account_number(message: &str) -> Option<String> {

    let tokens: Vec<_> = message.split_whitespace().collect();
    
    // Check for explicit account/card markers
    for idx in 0..tokens.len() {
        let token = clean_token(tokens[idx]).to_lowercase();
        
        // Handle A/C, account markers (standard length 8-16)
        if ["a/c", "ac", "acct", "account"].contains(&token.as_str()) && idx + 1 < tokens.len() {
            let candidate = normalize_account_token(tokens[idx + 1]);
            if is_valid_account_candidate(&candidate) {
                return Some(candidate);
            }
        }
        
        // Handle Card markers (accept 4-5 char suffixes like x1068)
        if token == "card" && idx + 1 < tokens.len() {
            let candidate = normalize_account_token(tokens[idx + 1]);
            if candidate.len() >= 4 && candidate.len() <= 5 && candidate.chars().any(|ch| ch.is_ascii_digit()) {
                return Some(format!("Card {}", candidate));
            }
        }

        if token == "ending" && idx + 1 < tokens.len() {
            let candidate = normalize_account_token(tokens[idx + 1]);
            if candidate.len() >= 4 && candidate.len() <= 6 && candidate.chars().all(|ch| ch.is_ascii_digit()) {
                return Some(format!("Card ending {}", candidate));
            }
        }
    }

    // Fallback: scan for account-like patterns (8-16 chars)
    for token in &tokens {
        let candidate = normalize_account_token(token);
        let is_masked_style = !candidate.is_empty()
            && candidate
                .chars()
                .all(|ch| ch.is_ascii_digit() || ch == 'X' || ch == 'x' || ch == '*')
            && candidate.chars().any(|ch| ch == 'X' || ch == 'x' || ch == '*')
            && candidate.chars().any(|ch| ch.is_ascii_digit());

        if candidate.len() >= 8 && candidate.len() <= 16 && is_masked_style {
            return Some(candidate);
        }
    }

    None
}

fn is_valid_account_candidate(candidate: &str) -> bool {
    if candidate.is_empty() {
        return false;
    }

    let lowered = candidate.to_ascii_lowercase();
    let reserved = [
        "towards", "to", "from", "on", "ref", "value", "bal", "clear", "bank", "upi", "call", "sms", "block",
    ];

    if reserved.contains(&lowered.as_str()) {
        return false;
    }

    let has_digit = candidate.chars().any(|ch| ch.is_ascii_digit());
    let has_mask_char = candidate.chars().any(|ch| ch == 'X' || ch == 'x' || ch == '*');

    has_digit || has_mask_char
}

fn extract_merchant_or_payee(message: &str) -> Option<String> {
    let tokens: Vec<_> = message.split_whitespace().collect();
    let marker_priority = ["at", "to", "towards", "from"];

    // In "from VPA <handle>" formats, extract only the VPA handle first.
    for idx in 0..tokens.len() {
        if clean_token(tokens[idx]).eq_ignore_ascii_case("from") && idx + 2 < tokens.len() {
            if clean_token(tokens[idx + 1]).eq_ignore_ascii_case("vpa") {
                let handle = clean_token(tokens[idx + 2]);
                if !handle.is_empty() {
                    return Some(handle);
                }
            }
        }
    }

    for preferred_marker in marker_priority {
        for idx in 0..tokens.len() {
            let marker = clean_token(tokens[idx]).to_lowercase();
            if marker == preferred_marker {
                // Ignore known support/alert tails like "... SMS BLOCK UPI to 7308...".
                if marker == "to" && idx > 0 {
                    let prev = clean_token(tokens[idx - 1]).to_lowercase();
                    if ["upi", "sms", "block", "call"].contains(&prev.as_str()) {
                        continue;
                    }
                }

                // Ignore source-bank phrases like "From HDFC Bank" as payee candidates.
                if marker == "from" && idx + 2 < tokens.len() {
                    let third = clean_token(tokens[idx + 2]).to_lowercase();
                    if third == "bank" {
                        continue;
                    }
                }

                let mut collected = Vec::new();
                let mut scan_idx = idx + 1;
                let stopwords = ["on", "ref", "avl", "bal", "clear", "value", "is", "a/c", "ac", "account", "bank", "via", "using", "the", "your", "my", "an", "a", "upi"];

                // In "towards <reference> -MERCHANT" formats, skip a leading numeric reference.
                if marker == "towards" && scan_idx < tokens.len() {
                    let first = clean_token(tokens[scan_idx]);
                    if !first.is_empty() && first.chars().all(|ch| ch.is_ascii_digit()) {
                        scan_idx += 1;
                    }
                }

                while scan_idx < tokens.len() && collected.len() < 3 {
                    let token = clean_token(tokens[scan_idx]);
                    let lowered = token.to_lowercase();
                    if token.is_empty() || stopwords.contains(&lowered.as_str()) {
                        break;
                    }

                    // Do not treat support/reference numbers as payee names.
                    if token.chars().all(|ch| ch.is_ascii_digit()) && token.len() >= 8 {
                        break;
                    }

                    collected.push(token);
                    scan_idx += 1;
                }

                if !collected.is_empty() {
                    return Some(collected.join(" "));
                }
            }
        }
    }

    None
}

fn is_dd_mm_yy_dash(token: &str) -> bool {
    let parts: Vec<_> = token.split('-').collect();
    if parts.len() != 3 {
        return false;
    }

    if !(parts[0].len() == 2
        && parts[1].len() == 2
        && parts[2].len() == 2
        && parts.iter().all(|part| part.chars().all(|ch| ch.is_ascii_digit())))
    {
        return false;
    }

    if let (Ok(day), Ok(month)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
        day >= 1 && day <= 31 && month >= 1 && month <= 12
    } else {
        false
    }
}
fn extract_amount_minor(message: &str) -> Option<i64> {
    let tokens: Vec<_> = message.split_whitespace().collect();

    for idx in 0..tokens.len() {
        let token = clean_token(tokens[idx]);
        let upper = token.to_uppercase();
        let prev_upper = if idx > 0 {
            clean_token(tokens[idx - 1]).to_uppercase()
        } else {
            String::new()
        };

        let prefixed = upper.starts_with("INR") || upper.starts_with("RS");
        let hinted = prefixed || prev_upper == "INR" || prev_upper == "RS";

        let mut numeric = token.to_string();
        if upper.starts_with("INR") {
            numeric = numeric.trim_start_matches(|c: char| {
                let upper_c = c.to_uppercase().collect::<String>();
                upper_c == "I" || upper_c == "N" || upper_c == "R"
            }).to_string();
        } else if upper.starts_with("RS") {
            numeric = numeric.trim_start_matches(|c: char| {
                let upper_c = c.to_uppercase().collect::<String>();
                upper_c == "R" || upper_c == "S"
            }).to_string();
        }
        
        numeric = numeric.trim_start_matches('.').to_string();
        numeric = numeric.replace(',', "");

        if numeric.starts_with('+') {
            numeric = numeric.trim_start_matches('+').to_string();
        }

        if hinted || numeric.contains('.') {
            if let Some(value) = decimal_to_minor_units(&numeric) {
                return Some(value);
            }
        }
    }

    None
}

fn normalize_date_dash_to_yyyy_mm_dd(date_str: &str) -> String {
    let parts: Vec<_> = date_str.split('-').collect();
    if parts.len() == 3 && parts[0].len() == 2 && parts[1].len() == 2 {
        if parts[2].len() == 2 {
            return format!("20{}-{}-{}", parts[2], parts[1], parts[0]);
        }
        if parts[2].len() == 4 {
            return format!("{}-{}-{}", parts[2], parts[1], parts[0]);
        }
    }
    date_str.to_string()
}
fn decimal_to_minor_units(value: &str) -> Option<i64> {
    let cleaned = value.trim();
    if cleaned.is_empty() {
        return None;
    }

    let mut parts = cleaned.split('.');
    let whole = parts.next()?;
    let decimal = parts.next().unwrap_or("0");

    if parts.next().is_some() || !whole.chars().all(|ch| ch.is_ascii_digit()) {
        return None;
    }

    if !decimal.chars().all(|ch| ch.is_ascii_digit()) || decimal.len() > 2 {
        return None;
    }

    let whole_minor = whole.parse::<i64>().ok()?.checked_mul(100)?;
    let decimal_minor = match decimal.len() {
        0 => 0,
        1 => decimal.parse::<i64>().ok()?.checked_mul(10)?,
        _ => decimal.parse::<i64>().ok()?,
    };

    whole_minor.checked_add(decimal_minor)
}

fn clean_token(token: &str) -> String {
    token
        .trim_matches(|ch: char| {
            matches!(
                ch,
                '.' | ',' | ';' | ':' | '(' | ')' | '[' | ']' | '{' | '}' | '"' | '\'' | '-' | '!' | '?'
            )
        })
        .to_string()
}

fn normalize_account_token(token: &str) -> String {
    clean_token(token)
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == 'X' || *ch == 'x' || *ch == '*')
        .collect()
}

fn is_yyyy_mm_dd(token: &str) -> bool {
    let parts: Vec<_> = token.split('-').collect();
    if parts.len() != 3 {
        return false;
    }

    if !(parts[0].len() == 4
        && parts[1].len() == 2
        && parts[2].len() == 2
        && parts.iter().all(|part| part.chars().all(|ch| ch.is_ascii_digit())))
    {
        return false;
    }

    if let (Ok(month), Ok(day)) = (parts[1].parse::<u32>(), parts[2].parse::<u32>()) {
        month >= 1 && month <= 12 && day >= 1 && day <= 31
    } else {
        false
    }
}

fn is_dd_mm_yyyy(token: &str) -> bool {
    let parts: Vec<_> = token.split('/').collect();
    if parts.len() != 3 {
        return false;
    }

    if !(parts[0].len() == 2
        && parts[1].len() == 2
        && parts[2].len() == 4
        && parts.iter().all(|part| part.chars().all(|ch| ch.is_ascii_digit())))
    {
        return false;
    }

    if let (Ok(day), Ok(month)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
        day >= 1 && day <= 31 && month >= 1 && month <= 12
    } else {
        false
    }
}

fn is_dd_mm_yy(token: &str) -> bool {
    let parts: Vec<_> = token.split('/').collect();
    if parts.len() != 3 {
        return false;
    }

    if !(parts[0].len() == 2
        && parts[1].len() == 2
        && parts[2].len() == 2
        && parts.iter().all(|part| part.chars().all(|ch| ch.is_ascii_digit())))
    {
        return false;
    }

    if let (Ok(day), Ok(month)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
        day >= 1 && day <= 31 && month >= 1 && month <= 12
    } else {
        false
    }
}

fn normalize_date_to_yyyy_mm_dd(date_str: &str) -> String {
    let parts: Vec<_> = date_str.split('/').collect();
    if parts.len() == 3 && parts[0].len() == 2 && parts[1].len() == 2 {
        if parts[2].len() == 4 {
            return format!("{}-{}-{}", parts[2], parts[1], parts[0]);
        }
        if parts[2].len() == 2 {
            return format!("20{}-{}-{}", parts[2], parts[1], parts[0]);
        }
        date_str.to_string()
    } else {
        date_str.to_string()
    }
}

fn uppercase_first(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        attempt_transaction_save_with_pool, classify_message_family, parse_preview_envelope,
        MessageFamily, SaveAccountContext, SaveTransactionAttemptRequest,
        SaveTransactionParsedPayload,
    };
    use sqlx::{sqlite::SqlitePoolOptions, Row};

    async fn setup_pool() -> sqlx::Pool<sqlx::Sqlite> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory sqlite pool");

        sqlx::raw_sql(include_str!("../../migrations/0001_create_accounts_and_ledger_entries.sql"))
            .execute(&pool)
            .await
            .expect("migration to apply");

        sqlx::query("INSERT INTO accounts (bank_name, account_number) VALUES ('HDFC Bank', 'XX1234')")
            .execute(&pool)
            .await
            .expect("account insert should succeed");

        let account_id = sqlx::query("SELECT id FROM accounts LIMIT 1")
            .fetch_one(&pool)
            .await
            .expect("account id should exist")
            .get::<i64, _>("id");

        sqlx::query(
            "INSERT INTO ledger_entries (account_id, entry_kind, amount_minor) VALUES ($1, 'opening_balance', 10000)",
        )
        .bind(account_id)
        .execute(&pool)
        .await
        .expect("opening entry insert should succeed");

        pool
    }

    async fn table_counts(pool: &sqlx::Pool<sqlx::Sqlite>) -> (i64, i64) {
        let account_count = sqlx::query("SELECT COUNT(*) AS count FROM accounts")
            .fetch_one(pool)
            .await
            .expect("account count query should succeed")
            .get::<i64, _>("count");

        let ledger_count = sqlx::query("SELECT COUNT(*) AS count FROM ledger_entries")
            .fetch_one(pool)
            .await
            .expect("ledger count query should succeed")
            .get::<i64, _>("count");

        (account_count, ledger_count)
    }

    #[tokio::test]
    async fn blocks_save_for_missing_critical_fields_without_mutation() {
        let pool = setup_pool().await;
        let before = table_counts(&pool).await;

        let result = attempt_transaction_save_with_pool(
            &pool,
            SaveTransactionAttemptRequest {
                account_context: SaveAccountContext {
                    account_id: 1,
                    bank_name: "HDFC Bank".to_string(),
                    account_number: "XX1234".to_string(),
                },
                parsed_payload: SaveTransactionParsedPayload {
                    raw_text: "debited INR 1250.50".to_string(),
                    normalized_text: "debited INR 1250.50".to_string(),
                    amount_minor: Some(125050),
                    direction: Some("debit".to_string()),
                    transaction_date: None,
                    bank_name: None,
                    account_number: None,
                    merchant_or_payee: None,
                    readiness_state: Some("needs-review".to_string()),
                },
                mismatch_resolution: None,
                duplicate_decision: None,
            },
        )
        .await;

        assert!(!result.ok);
        let error = result.error.expect("validation error expected");
        assert_eq!(error.code, "VALIDATION_FAILED");

        let details = error.details.expect("details should exist");
        let blocked = details
            .get("blockedFields")
            .and_then(|value| value.as_array())
            .expect("blockedFields array should exist");

        let fields: Vec<_> = blocked
            .iter()
            .filter_map(|item| item.get("field"))
            .filter_map(|value| value.as_str())
            .collect();

        assert_eq!(
            fields,
            vec!["transactionDate", "bankName", "accountNumber", "merchantOrPayee"]
        );

        let after = table_counts(&pool).await;
        assert_eq!(before, after);
    }

    #[tokio::test]
    async fn treats_ambiguous_critical_values_as_invalid_and_deterministic() {
        let pool = setup_pool().await;

        let request = SaveTransactionAttemptRequest {
            account_context: SaveAccountContext {
                account_id: 1,
                bank_name: "HDFC Bank".to_string(),
                account_number: "XX1234".to_string(),
            },
            parsed_payload: SaveTransactionParsedPayload {
                raw_text: "sample".to_string(),
                normalized_text: "sample".to_string(),
                amount_minor: Some(1000),
                direction: Some("debit".to_string()),
                transaction_date: Some("2026/05/01".to_string()),
                bank_name: Some("unknown".to_string()),
                account_number: Some("N/A".to_string()),
                merchant_or_payee: Some("ambiguous".to_string()),
                readiness_state: Some("ready".to_string()),
            },
            mismatch_resolution: None,
            duplicate_decision: None,
        };

        let first = attempt_transaction_save_with_pool(&pool, request).await;

        let second = attempt_transaction_save_with_pool(
            &pool,
            SaveTransactionAttemptRequest {
                account_context: SaveAccountContext {
                    account_id: 1,
                    bank_name: "HDFC Bank".to_string(),
                    account_number: "XX1234".to_string(),
                },
                parsed_payload: SaveTransactionParsedPayload {
                    raw_text: "sample".to_string(),
                    normalized_text: "sample".to_string(),
                    amount_minor: Some(1000),
                    direction: Some("debit".to_string()),
                    transaction_date: Some("2026/05/01".to_string()),
                    bank_name: Some("unknown".to_string()),
                    account_number: Some("N/A".to_string()),
                    merchant_or_payee: Some("ambiguous".to_string()),
                    readiness_state: Some("ready".to_string()),
                },
                mismatch_resolution: None,
                duplicate_decision: None,
            },
        )
        .await;

        assert!(!first.ok);
        assert!(!second.ok);

        let first_json = serde_json::to_value(&first.error).expect("first error should serialize");
        let second_json = serde_json::to_value(&second.error).expect("second error should serialize");
        assert_eq!(first_json, second_json);
    }

    #[tokio::test]
    async fn passes_validation_for_complete_payload_without_mutation() {
        let pool = setup_pool().await;
        let before = table_counts(&pool).await;

        let result = attempt_transaction_save_with_pool(
            &pool,
            SaveTransactionAttemptRequest {
                account_context: SaveAccountContext {
                    account_id: 1,
                    bank_name: "HDFC Bank".to_string(),
                    account_number: "XX1234".to_string(),
                },
                parsed_payload: SaveTransactionParsedPayload {
                    raw_text: "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar."
                        .to_string(),
                    normalized_text:
                        "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar."
                            .to_string(),
                    amount_minor: Some(125050),
                    direction: Some("debit".to_string()),
                    transaction_date: Some("2026-05-01".to_string()),
                    bank_name: Some("HDFC Bank".to_string()),
                    account_number: Some("XX1234".to_string()),
                    merchant_or_payee: Some("BigBazaar".to_string()),
                    readiness_state: Some("ready".to_string()),
                },
                mismatch_resolution: None,
                duplicate_decision: None,
            },
        )
        .await;

        assert!(result.ok);
        let data = result.data.expect("success payload expected");
        assert_eq!(data.validation_state, "passed");
        assert!(!data.accepted_for_write);
        assert_eq!(
            data.checked_fields,
            vec![
                "amountMinor",
                "direction",
                "transactionDate",
                "bankName",
                "accountNumber",
                "merchantOrPayee"
            ]
        );

        let after = table_counts(&pool).await;
        assert_eq!(before, after);
    }

    #[tokio::test]
    async fn blocks_save_until_account_mismatch_resolution_is_provided() {
        let pool = setup_pool().await;

        let result = attempt_transaction_save_with_pool(
            &pool,
            SaveTransactionAttemptRequest {
                account_context: SaveAccountContext {
                    account_id: 1,
                    bank_name: "HDFC Bank".to_string(),
                    account_number: "XX1234".to_string(),
                },
                parsed_payload: SaveTransactionParsedPayload {
                    raw_text: "sample".to_string(),
                    normalized_text: "sample".to_string(),
                    amount_minor: Some(125050),
                    direction: Some("debit".to_string()),
                    transaction_date: Some("2026-05-01".to_string()),
                    bank_name: Some("ICICI Bank".to_string()),
                    account_number: Some("XX9999".to_string()),
                    merchant_or_payee: Some("BigBazaar".to_string()),
                    readiness_state: Some("ready".to_string()),
                },
                mismatch_resolution: None,
                duplicate_decision: None,
            },
        )
        .await;

        assert!(!result.ok);
        let error = result.error.expect("validation error expected");
        let details = error.details.expect("details should exist");
        let mismatch_detected = details
            .get("accountMismatch")
            .and_then(|value| value.get("detected"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        assert!(mismatch_detected);
    }

    #[tokio::test]
    async fn blocks_save_until_duplicate_decision_is_provided() {
        let pool = setup_pool().await;

        let result = attempt_transaction_save_with_pool(
            &pool,
            SaveTransactionAttemptRequest {
                account_context: SaveAccountContext {
                    account_id: 1,
                    bank_name: "HDFC Bank".to_string(),
                    account_number: "XX1234".to_string(),
                },
                parsed_payload: SaveTransactionParsedPayload {
                    raw_text: "duplicate message".to_string(),
                    normalized_text: "possible duplicate already processed message".to_string(),
                    amount_minor: Some(125050),
                    direction: Some("debit".to_string()),
                    transaction_date: Some("2026-05-01".to_string()),
                    bank_name: Some("HDFC Bank".to_string()),
                    account_number: Some("XX1234".to_string()),
                    merchant_or_payee: Some("BigBazaar".to_string()),
                    readiness_state: Some("ready".to_string()),
                },
                mismatch_resolution: None,
                duplicate_decision: None,
            },
        )
        .await;

        assert!(!result.ok);
        let error = result.error.expect("validation error expected");
        let details = error.details.expect("details should exist");
        let duplicate_detected = details
            .get("duplicateCandidate")
            .and_then(|value| value.get("detected"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        assert!(duplicate_detected);
    }

    #[tokio::test]
    async fn requires_both_decisions_when_both_signals_are_present() {
        let pool = setup_pool().await;

        let blocked_with_partial_decisions = attempt_transaction_save_with_pool(
            &pool,
            SaveTransactionAttemptRequest {
                account_context: SaveAccountContext {
                    account_id: 1,
                    bank_name: "HDFC Bank".to_string(),
                    account_number: "XX1234".to_string(),
                },
                parsed_payload: SaveTransactionParsedPayload {
                    raw_text: "duplicate message".to_string(),
                    normalized_text: "possible duplicate already processed message".to_string(),
                    amount_minor: Some(125050),
                    direction: Some("debit".to_string()),
                    transaction_date: Some("2026-05-01".to_string()),
                    bank_name: Some("ICICI Bank".to_string()),
                    account_number: Some("XX9999".to_string()),
                    merchant_or_payee: Some("BigBazaar".to_string()),
                    readiness_state: Some("ready".to_string()),
                },
                mismatch_resolution: Some("use-selected-account".to_string()),
                duplicate_decision: None,
            },
        )
        .await;

        assert!(!blocked_with_partial_decisions.ok);

        let fully_resolved = attempt_transaction_save_with_pool(
            &pool,
            SaveTransactionAttemptRequest {
                account_context: SaveAccountContext {
                    account_id: 1,
                    bank_name: "HDFC Bank".to_string(),
                    account_number: "XX1234".to_string(),
                },
                parsed_payload: SaveTransactionParsedPayload {
                    raw_text: "duplicate message".to_string(),
                    normalized_text: "possible duplicate already processed message".to_string(),
                    amount_minor: Some(125050),
                    direction: Some("debit".to_string()),
                    transaction_date: Some("2026-05-01".to_string()),
                    bank_name: Some("ICICI Bank".to_string()),
                    account_number: Some("XX9999".to_string()),
                    merchant_or_payee: Some("BigBazaar".to_string()),
                    readiness_state: Some("ready".to_string()),
                },
                mismatch_resolution: Some("use-selected-account".to_string()),
                duplicate_decision: Some("save-as-new".to_string()),
            },
        )
        .await;

        assert!(fully_resolved.ok);
    }



    #[test]
    fn parses_supported_debit_credit_and_mixed_order_messages() {
        let fixtures = vec![
            (
                "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.",
                "debit",
                125050,
            ),
            (
                "ICICI Bank Msg: INR 5000 credited to account 9988 on 2026-05-01 from ACME PAYROLL.",
                "credit",
                500000,
            ),
            (
                "On 2026-05-03, at FreshMart, SBI Bank confirms account 5566 was credited INR 750.00.",
                "credit",
                75000,
            ),

            (
                "Spent Rs.322.08 From HDFC Bank Card x1068 At PYU*ZOMATO On 2026-05-06:09:55:03 Bal Rs.258336.13 Not You? Call 18002586161/SMS BLOCK DC  1086 to 7308080808",
                "debit",
                32208,
            ),
        ];
        for (message, expected_direction, expected_amount_minor) in fixtures {
            let result = parse_preview_envelope(message);

            assert!(result.ok);
            let parsed = result.data.expect("parsed payload to exist");
            assert_eq!(parsed.direction.as_deref(), Some(expected_direction));
            assert_eq!(parsed.amount_minor, Some(expected_amount_minor));
            let readiness = parsed.readiness_state;
            assert!(readiness == "ready" || readiness == "needs-review");
        }
    }

    #[test]
    fn returns_deterministic_error_for_malformed_messages() {
        let malformed = vec![
            "Unsupported text without parseable fields",
            "No amount date or direction here",
        ];

        for message in malformed {
            let first = parse_preview_envelope(message);
            let second = parse_preview_envelope(message);

            assert!(!first.ok);
            assert!(!second.ok);
            assert_eq!(first.error.as_ref().map(|error| &error.code), second.error.as_ref().map(|error| &error.code));
            assert_eq!(first.error.as_ref().map(|error| &error.message), second.error.as_ref().map(|error| &error.message));
        }
    }

    #[test]
    fn parses_upi_transfer_with_two_digit_date_and_destination_bank() {
        let message = "Sent Rs.385.00 From HDFC Bank A/C *9410 To Axis Bank On 05/05/26 Ref 182657202639 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(38500));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-05-05"));
        assert_eq!(parsed.bank_name.as_deref(), Some("HDFC Bank"));
        assert_eq!(parsed.account_number.as_deref(), Some("*9410"));
        assert_eq!(parsed.merchant_or_payee.as_deref(), Some("Axis"));
        assert_eq!(parsed.readiness_state, "ready");
    }

    #[test]
    fn parses_credit_card_message_with_ending_suffix() {
        let message = "Rs.329.75 spent on your SBI Credit Card ending 6917 at BIGBASKET on 03/05/26. Trxn. not done by you? Report at https://sbicard.com/Dispute";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(32975));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-05-03"));
        assert_eq!(parsed.bank_name.as_deref(), Some("SBI Bank"));
        assert_eq!(parsed.account_number.as_deref(), Some("Card ending 6917"));
        assert_eq!(parsed.merchant_or_payee.as_deref(), Some("BIGBASKET"));
        assert_eq!(parsed.readiness_state, "ready");
    }

    #[test]
    fn parses_credit_alert_with_hyphenated_short_date_and_vpa_source() {
        let message = "Credit Alert! Rs.812.00 credited to HDFC Bank A/c XX9410 on 19-04-26 from VPA aatish3@okhdfcbank (UPI 121852111111)";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("credit"));
        assert_eq!(parsed.amount_minor, Some(81200));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-04-19"));
        assert_eq!(parsed.bank_name.as_deref(), Some("HDFC Bank"));
        assert_eq!(parsed.account_number.as_deref(), Some("XX9410"));
        assert_eq!(parsed.merchant_or_payee.as_deref(), Some("aatish3@okhdfcbank"));
        assert_eq!(parsed.readiness_state, "ready");
    }

    #[test]
    fn parses_dns_message_with_mmm_date_and_towards_merchant() {
        let message = "INR 17,426.00 debited to A/c XXXXXXXXXX5814 towards 084403300131708 -GOGATE Value 10-APR-2026 . Clear Bal is INR 25,332.87 -DNS Bank";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(1742600));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-04-10"));
        assert_eq!(parsed.bank_name.as_deref(), Some("DNS Bank"));
        assert_eq!(parsed.account_number.as_deref(), Some("XXXXXXXXXX5814"));
        assert_eq!(parsed.merchant_or_payee.as_deref(), Some("GOGATE"));
        assert_eq!(parsed.readiness_state, "ready");
    }

    #[test]
    fn parses_salary_credit_without_date_as_needs_review() {
        let message = "Salary Credited! INR 5,00,000.00 to HDFC Bank A/c XX9410 Bal: INR 2,62,501.16 Get statement and more on WhatsApp";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("credit"));
        assert_eq!(parsed.amount_minor, Some(50000000));
        assert_eq!(parsed.transaction_date, None);
        assert_eq!(parsed.bank_name.as_deref(), Some("HDFC Bank"));
        assert_eq!(parsed.account_number.as_deref(), Some("XX9410"));
        assert_eq!(parsed.readiness_state, "needs-review");
    }

    #[test]
    fn preserves_legacy_manually_tested_patterns_baseline() {
        let cases = vec![
            (
                "HDFC Bank Alert: A/c XX1234 debited by INR 1,250.50 on 2026-05-01 at BigBazaar.",
                Some("debit"),
                Some(125050),
                Some("2026-05-01"),
                Some("HDFC Bank"),
                Some("XX1234"),
                Some("BigBazaar"),
                "ready",
            ),
            (
                "Sent Rs.385.00 From HDFC Bank A/C *9410 To Axis Bank On 05/05/26 Ref 182657202639 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808",
                Some("debit"),
                Some(38500),
                Some("2026-05-05"),
                Some("HDFC Bank"),
                Some("*9410"),
                Some("Axis"),
                "ready",
            ),
            (
                "Rs.329.75 spent on your SBI Credit Card ending 6917 at BIGBASKET on 03/05/26. Trxn. not done by you? Report at https://sbicard.com/Dispute",
                Some("debit"),
                Some(32975),
                Some("2026-05-03"),
                Some("SBI Bank"),
                Some("Card ending 6917"),
                Some("BIGBASKET"),
                "ready",
            ),
            (
                "Salary Credited! INR 5,00,000.00 to HDFC Bank A/c XX9410 Bal: INR 2,62,501.16 Get statement and more on WhatsApp",
                Some("credit"),
                Some(50000000),
                None,
                Some("HDFC Bank"),
                Some("XX9410"),
                Some("HDFC"),
                "needs-review",
            ),
        ];

        for (
            message,
            direction,
            amount_minor,
            transaction_date,
            bank_name,
            account_number,
            merchant_or_payee,
            readiness_state,
        ) in cases
        {
            let result = parse_preview_envelope(message);
            assert!(result.ok, "expected message to parse: {message}");

            let parsed = result.data.expect("parsed payload to exist");
            assert_eq!(parsed.direction.as_deref(), direction);
            assert_eq!(parsed.amount_minor, amount_minor);
            assert_eq!(parsed.transaction_date.as_deref(), transaction_date);
            assert_eq!(parsed.bank_name.as_deref(), bank_name);
            assert_eq!(parsed.account_number.as_deref(), account_number);
            assert_eq!(parsed.merchant_or_payee.as_deref(), merchant_or_payee);
            assert_eq!(parsed.readiness_state, readiness_state);
        }
    }

    #[test]
    fn classifies_message_families_without_affecting_legacy_parse_flow() {
        assert_eq!(
            classify_message_family("Balance falls below threshold. Clear Bal is INR 1200."),
            MessageFamily::BalanceAlert
        );
        assert_eq!(
            classify_message_family("Cheque return alert on your account."),
            MessageFamily::ChequeEvent
        );
        assert_eq!(
            classify_message_family("ATM cash withdrawal of INR 2000."),
            MessageFamily::AtmDebit
        );
        assert_eq!(
            classify_message_family("Your debit card was swiped for purchase."),
            MessageFamily::CardSpend
        );
        assert_eq!(
            classify_message_family("UPI payment received from VPA user@okbank."),
            MessageFamily::UpiOrTransfer
        );
        assert_eq!(
            classify_message_family("INR 5000 credited to account 9988."),
            MessageFamily::AccountCreditOrDebit
        );
    }

    #[test]
    fn parses_purchase_wording_as_card_debit_with_family_direction_hint() {
        let message = "Your HDFC Bank Credit Card ending 4455 was used for purchase of INR 1,000.00 at AMAZON on 2026-05-07";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(100000));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-05-07"));
        assert_eq!(parsed.bank_name.as_deref(), Some("HDFC Bank"));
        assert_eq!(parsed.account_number.as_deref(), Some("Card ending 4455"));
        assert_eq!(parsed.merchant_or_payee.as_deref(), Some("AMAZON"));
    }

    #[test]
    fn parses_cardno_marker_for_card_identifier() {
        let message = "INR 250.00 spent on your HDFC Bank Credit CardNo XX1234 at CAFE on 2026-05-04";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(25000));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-05-04"));
        assert_eq!(parsed.bank_name.as_deref(), Some("HDFC Bank"));
        assert_eq!(parsed.account_number.as_deref(), Some("XX1234"));
        assert_eq!(parsed.merchant_or_payee.as_deref(), Some("CAFE"));
    }

    #[test]
    fn downgrades_threshold_configuration_alert_to_parse_failed() {
        let message = "Debit threshold alert set at INR 5,000 on 2026-05-08 for A/c XX1234";

        let result = parse_preview_envelope(message);

        assert!(!result.ok);
        assert!(result.data.is_none());
        let error = result.error.expect("error payload expected");
        assert_eq!(error.code, "PARSE_FAILED");
    }

    #[test]
    fn keeps_transaction_with_balance_tail_note_parseable() {
        let message = "INR 17,426.00 debited to A/c XXXXXXXXXX5814 towards 084403300131708 -GOGATE Value 10-APR-2026 . Clear Bal is INR 25,332.87 -DNS Bank";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(1742600));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-04-10"));
    }

    #[test]
    fn parses_card_merchant_marker_with_family_hint() {
        let message = "INR 499.00 spent on your HDFC Bank Credit Card ending 4455 merchant AMAZON on 2026-05-08";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(49900));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-05-08"));
        assert_eq!(parsed.bank_name.as_deref(), Some("HDFC Bank"));
        assert_eq!(parsed.account_number.as_deref(), Some("Card ending 4455"));
        assert_eq!(parsed.merchant_or_payee.as_deref(), Some("AMAZON"));
    }

    #[test]
    fn parses_upi_beneficiary_marker_with_family_hint() {
        let message = "INR 150.00 debited from A/c XX1234 to beneficiary RAHUL on 2026-05-08 via UPI";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(15000));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-05-08"));
        assert_eq!(parsed.account_number.as_deref(), Some("XX1234"));
        assert_eq!(parsed.merchant_or_payee.as_deref(), Some("RAHUL"));
    }

    #[test]
    fn does_not_use_upi_block_number_as_payee_when_explicit_payee_missing() {
        let message = "Sent Rs.180.00 From HDFC Bank A/C *9410 On 11/05/26 Ref 111126292388 Not You? Call 18002586161/SMS BLOCK UPI to 7308080800";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(18000));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-05-11"));
        assert_eq!(parsed.account_number.as_deref(), Some("*9410"));
        assert_ne!(parsed.merchant_or_payee.as_deref(), Some("7308080800"));
        if let Some(payee) = parsed.merchant_or_payee.as_deref() {
            assert!(
                !payee.chars().all(|ch| ch.is_ascii_digit()),
                "payee should never be a plain numeric support/reference value"
            );
        }
        assert_eq!(parsed.readiness_state, "needs-review");
    }

    #[test]
    fn keeps_account_number_missing_when_message_has_bank_and_payee_but_no_account_token() {
        let message = "Sent Rs.180.00 From HDFC Bank To Mr YOGESH RAJENDRA RAKSHE On 11/05/26 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(18000));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-05-11"));
        assert_eq!(parsed.bank_name.as_deref(), Some("HDFC Bank"));
        assert_eq!(parsed.account_number, None);
        assert_eq!(parsed.merchant_or_payee.as_deref(), Some("Mr YOGESH RAJENDRA"));
        assert_eq!(parsed.readiness_state, "needs-review");
    }

    #[test]
    fn keeps_needs_review_when_ac_marker_has_no_account_value() {
        let message = "INR 17,426.00 debited to A/c towards 084403300131700 -GOKHALE Value 10-MAY-2026 . Clear Bal is INR 25,905.10 -DNS Bank";

        let result = parse_preview_envelope(message);

        assert!(result.ok);
        let parsed = result.data.expect("parsed payload to exist");
        assert_eq!(parsed.direction.as_deref(), Some("debit"));
        assert_eq!(parsed.amount_minor, Some(1742600));
        assert_eq!(parsed.transaction_date.as_deref(), Some("2026-05-10"));
        assert_eq!(parsed.bank_name.as_deref(), Some("DNS Bank"));
        assert_eq!(parsed.account_number, None);
        assert_eq!(parsed.merchant_or_payee.as_deref(), Some("GOKHALE"));
        assert_eq!(parsed.readiness_state, "needs-review");
    }
}

fn is_dd_mmm_yyyy(token: &str) -> bool {
    let parts: Vec<_> = token.split('-').collect();
    if parts.len() != 3 {
        return false;
    }

    if !(parts[0].len() == 2
        && parts[2].len() == 4
        && parts[0].chars().all(|ch| ch.is_ascii_digit())
        && parts[2].chars().all(|ch| ch.is_ascii_digit()))
    {
        return false;
    }

    let month = month_abbrev_to_number(parts[1]);
    if month.is_none() {
        return false;
    }

    if let Ok(day) = parts[0].parse::<u32>() {
        day >= 1 && day <= 31
    } else {
        false
    }
}

fn normalize_date_mmm_to_yyyy_mm_dd(date_str: &str) -> String {
    let parts: Vec<_> = date_str.split('-').collect();
    if parts.len() != 3 {
        return date_str.to_string();
    }

    if parts[0].len() != 2 || parts[2].len() != 4 {
        return date_str.to_string();
    }

    match month_abbrev_to_number(parts[1]) {
        Some(month) => format!("{}-{:02}-{}", parts[2], month, parts[0]),
        None => date_str.to_string(),
    }
}

fn month_abbrev_to_number(value: &str) -> Option<u32> {
    match value.to_ascii_uppercase().as_str() {
        "JAN" => Some(1),
        "FEB" => Some(2),
        "MAR" => Some(3),
        "APR" => Some(4),
        "MAY" => Some(5),
        "JUN" => Some(6),
        "JUL" => Some(7),
        "AUG" => Some(8),
        "SEP" => Some(9),
        "OCT" => Some(10),
        "NOV" => Some(11),
        "DEC" => Some(12),
        _ => None,
    }
}