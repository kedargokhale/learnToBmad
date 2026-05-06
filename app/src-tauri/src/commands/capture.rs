use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

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

    let amount_minor = extract_amount_minor(&normalized);
    let direction = extract_direction(&normalized);
    let transaction_date = extract_date(&normalized);
    let bank_name = extract_bank_name(&normalized);
    let account_number = extract_account_number(&normalized);
    let merchant_or_payee = extract_merchant_or_payee(&normalized);

    if amount_minor.is_none() || direction.is_none() || transaction_date.is_none() {
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

fn normalize_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn extract_direction(message: &str) -> Option<String> {
    let lowered = message.to_lowercase();
    let tokens: Vec<&str> = lowered.split_whitespace().collect();

    let debit_keywords = ["debited", "debit", "withdrawn", "spent", "dr"];
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
        if is_yyyy_mm_dd(&cleaned) {
            return Some(cleaned);
        }
        if is_dd_mm_yyyy(&cleaned) {
            return Some(normalize_date_to_yyyy_mm_dd(&cleaned));
        }
    }

    None
}

fn extract_bank_name(message: &str) -> Option<String> {
    let tokens: Vec<_> = message.split_whitespace().collect();
    let known_banks = ["hdfc", "icici", "sbi", "axis", "kotak", "yes", "boi", "union", "indian", "state", "federal", "idbi", "hsbc", "standard", "bank"];

    for idx in 0..tokens.len() {
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
    for idx in 0..tokens.len() {
        let token = clean_token(tokens[idx]).to_lowercase();
        if ["a/c", "ac", "acct", "account"].contains(&token.as_str()) && idx + 1 < tokens.len() {
            let candidate = normalize_account_token(tokens[idx + 1]);
            if !candidate.is_empty() {
                return Some(candidate);
            }
        }
    }

    for token in &tokens {
        let candidate = normalize_account_token(token);
        if candidate.len() >= 8 && candidate.len() <= 16 && candidate.chars().any(|ch| ch.is_ascii_digit()) && candidate.chars().any(|ch| ch.is_ascii_alphabetic() || ch == 'X' || ch == 'x' || ch == '*') {
            return Some(candidate);
        }
    }

    None
}

fn extract_merchant_or_payee(message: &str) -> Option<String> {
    let tokens: Vec<_> = message.split_whitespace().collect();

    for idx in 0..tokens.len() {
        let marker = clean_token(tokens[idx]).to_lowercase();
        if ["at", "to", "from"].contains(&marker.as_str()) {
            let mut collected = Vec::new();
            let mut scan_idx = idx + 1;
            let stopwords = ["on", "ref", "avl", "bal", "a/c", "ac", "account", "bank", "via", "using", "the", "your", "my", "an", "a"];

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

    None
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
                '.' | ',' | ';' | ':' | '(' | ')' | '[' | ']' | '{' | '}' | '"' | '\''
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

fn normalize_date_to_yyyy_mm_dd(date_str: &str) -> String {
    let parts: Vec<_> = date_str.split('/').collect();
    if parts.len() == 3 && parts[0].len() == 2 && parts[1].len() == 2 && parts[2].len() == 4 {
        format!("{}-{}-{}", parts[2], parts[1], parts[0])
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
    use super::parse_preview_envelope;



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
}