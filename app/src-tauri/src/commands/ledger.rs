use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Pool, Row, Sqlite};
use tauri::AppHandle;

use crate::db::ledger;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountRequest {
    pub bank_name: String,
    pub account_number: String,
    pub opening_balance_minor: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountResponse {
    pub account_id: i64,
    pub bank_name: String,
    pub account_number: String,
    pub opening_balance_minor: i64,
    pub opening_entry_id: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntrySummary {
    pub id: i64,
    pub entry_kind: String,
    pub amount_minor: i64,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_transaction_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub final_category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_source: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerAccountSummary {
    pub id: i64,
    pub bank_name: String,
    pub account_number: String,
    pub current_balance_minor: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerBaselineResponse {
    pub account: Option<LedgerAccountSummary>,
    pub entries: Vec<LedgerEntrySummary>,
    pub category_insights: Vec<CategoryInsightSummary>,
    pub merchant_insights: Vec<MerchantInsightSummary>,
    pub trend_alert: TrendAlertSummary,
    pub running_balance: RunningBalanceSummary,
    pub insight_summary: Vec<InsightSummaryCard>,
    pub ordering: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightSummaryCard {
    pub kind: &'static str,
    pub title: String,
    pub headline: String,
    pub metric_label: String,
    pub metric_value: String,
    pub supporting_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub badge_label: Option<String>,
    pub is_empty: bool,
    pub empty_state: InsightCardEmptyState,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightCardEmptyState {
    pub title: String,
    pub detail: String,
    pub next_action: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrendAlertSummary {
    pub window_preset: &'static str,
    pub current_spend_minor: i64,
    pub baseline_spend_minor: i64,
    pub delta_percent: f64,
    pub threshold_percent: f64,
    pub is_alert: bool,
    pub reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningBalanceSummary {
    pub window_preset: &'static str,
    pub points: Vec<RunningBalancePoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningBalancePoint {
    pub timestamp: String,
    pub balance_minor: i64,
    pub delta_minor: i64,
    pub entry_id: i64,
    pub entry_kind: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryInsightSummary {
    pub category_name: String,
    pub total_amount_minor: i64,
    pub share_percent: f64,
    pub transaction_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantInsightSummary {
    pub merchant_or_payee: String,
    pub total_amount_minor: i64,
    pub transaction_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_date: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCaptureCategoryRequest {
    pub transaction_id: i64,
    pub final_category: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCaptureCategoryResponse {
    pub transaction_id: i64,
    pub final_category: String,
    pub category_source: String,
    pub audit_entry_id: i64,
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

#[derive(Debug)]
pub(crate) struct CommandError {
    code: &'static str,
    message: String,
    hint: Option<String>,
    details: Option<serde_json::Value>,
}

impl CommandError {
    fn validation(message: impl Into<String>, field: &'static str) -> Self {
        Self {
            code: "VALIDATION_FAILED",
            message: message.into(),
            hint: Some("Correct the highlighted field and try again.".to_string()),
            details: Some(json!({ "field": field })),
        }
    }

    fn duplicate_account(bank_name: &str, account_number: &str) -> Self {
        Self {
            code: "ACCOUNT_ALREADY_EXISTS",
            message: "An account already exists for that bank and account number.".to_string(),
            hint: Some("Review the account details or use the existing ledger account.".to_string()),
            details: Some(json!({
                "bankName": bank_name,
                "accountNumber": account_number,
            })),
        }
    }

    fn persistence(message: impl Into<String>) -> Self {
        Self {
            code: "PERSISTENCE_ERROR",
            message: message.into(),
            hint: Some("Retry after restarting the app. If the problem persists, inspect the local database file.".to_string()),
            details: None,
        }
    }

    fn into_envelope<T>(self) -> CommandEnvelope<T>
    where
        T: Serialize,
    {
        CommandEnvelope {
            ok: false,
            data: None,
            error: Some(ErrorEnvelope {
                code: self.code,
                message: self.message,
                hint: self.hint,
                details: self.details,
            }),
        }
    }
}

#[tauri::command]
pub async fn create_account(
    app: AppHandle,
    payload: CreateAccountRequest,
) -> CommandEnvelope<CreateAccountResponse> {
    match ledger::sqlite_pool(&app).await {
        Ok(pool) => match create_account_with_pool(&pool, payload).await {
            Ok(account) => CommandEnvelope {
                ok: true,
                data: Some(account),
                error: None,
            },
            Err(error) => error.into_envelope(),
        },
        Err(error) => CommandError::persistence(error).into_envelope(),
    }
}

async fn create_account_with_pool(
    pool: &Pool<Sqlite>,
    payload: CreateAccountRequest,
) -> Result<CreateAccountResponse, CommandError> {
    validate_request(&payload)?;

    let bank_name = payload.bank_name.trim().to_string();
    let account_number = payload.account_number.trim().to_string();
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| CommandError::persistence(error.to_string()))?;

    let account_insert = sqlx::query(
        "INSERT INTO accounts (bank_name, account_number) VALUES ($1, $2)",
    )
    .bind(&bank_name)
    .bind(&account_number)
    .execute(&mut *transaction)
    .await;

    let account_id = match account_insert {
        Ok(result) => result.last_insert_rowid(),
        Err(error) => {
            if is_unique_violation(&error) {
                return Err(CommandError::duplicate_account(&bank_name, &account_number));
            }

            return Err(CommandError::persistence(error.to_string()));
        }
    };

    let ledger_result = sqlx::query(
        "INSERT INTO ledger_entries (account_id, entry_kind, amount_minor) VALUES ($1, 'opening_balance', $2)",
    )
    .bind(account_id)
    .bind(payload.opening_balance_minor)
    .execute(&mut *transaction)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?;

    transaction
        .commit()
        .await
        .map_err(|error| CommandError::persistence(error.to_string()))?;

    let opening_entry_id = ledger_result.last_insert_rowid();

    Ok(CreateAccountResponse {
        account_id,
        bank_name,
        account_number,
        opening_balance_minor: payload.opening_balance_minor,
        opening_entry_id,
    })
}

fn validate_request(payload: &CreateAccountRequest) -> Result<(), CommandError> {
    if payload.bank_name.trim().is_empty() {
        return Err(CommandError::validation(
            "Bank name is required before the ledger can be created.",
            "bankName",
        ));
    }

    if payload.account_number.trim().is_empty() {
        return Err(CommandError::validation(
            "Account number is required before the ledger can be created.",
            "accountNumber",
        ));
    }

    const MAX_OPENING_BALANCE_MINOR: i64 = 999999999; // ~9,999,999.99 major units

    if payload.opening_balance_minor < 0 {
        return Err(CommandError::validation(
            "Opening balance must be zero or greater.",
            "openingBalance",
        ));
    }

    if payload.opening_balance_minor > MAX_OPENING_BALANCE_MINOR {
        return Err(CommandError::validation(
            "Opening balance cannot exceed 9,999,999.99.",
            "openingBalance",
        ));
    }

    Ok(())
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    match error {
        sqlx::Error::Database(db_err) => {
            // Check for UNIQUE constraint violation code
            db_err.code().map_or(false, |code| code == "23505") ||
            db_err.message().contains("UNIQUE constraint failed")
        },
        _ => false,
    }
}

const CATEGORY_TAXONOMY: [&str; 12] = [
    "groceries",
    "dining",
    "transport",
    "shopping",
    "utilities",
    "entertainment",
    "healthcare",
    "education",
    "salary",
    "investment",
    "transfer",
    "other",
];

fn normalize_category(value: &str) -> Option<String> {
    let lowered = value.trim().to_ascii_lowercase();
    if CATEGORY_TAXONOMY.iter().any(|category| *category == lowered) {
        Some(lowered)
    } else {
        None
    }
}

#[tauri::command]
pub async fn update_capture_transaction_category(
    app: AppHandle,
    payload: UpdateCaptureCategoryRequest,
) -> CommandEnvelope<UpdateCaptureCategoryResponse> {
    match ledger::sqlite_pool(&app).await {
        Ok(pool) => match update_capture_transaction_category_with_pool(&pool, payload).await {
            Ok(data) => CommandEnvelope {
                ok: true,
                data: Some(data),
                error: None,
            },
            Err(error) => error.into_envelope(),
        },
        Err(error) => CommandError::persistence(error).into_envelope(),
    }
}

async fn update_capture_transaction_category_with_pool(
    pool: &Pool<Sqlite>,
    payload: UpdateCaptureCategoryRequest,
) -> Result<UpdateCaptureCategoryResponse, CommandError> {
    if payload.transaction_id <= 0 {
        return Err(CommandError::validation(
            "Transaction id is required before updating category.",
            "transactionId",
        ));
    }

    let next_category = normalize_category(&payload.final_category).ok_or_else(|| {
        CommandError::validation(
            "Choose a valid category from the predefined taxonomy.",
            "finalCategory",
        )
    })?;

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| CommandError::persistence(error.to_string()))?;

    let existing_row = sqlx::query(
        "SELECT id, suggested_category, final_category, category_source, save_state FROM capture_transactions WHERE id = $1",
    )
    .bind(payload.transaction_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?;

    let Some(existing_row) = existing_row else {
        return Err(CommandError::validation(
            "Capture transaction not found for category update.",
            "transactionId",
        ));
    };

    let save_state = existing_row.get::<String, _>("save_state");
    if save_state != "persisted" {
        return Err(CommandError::validation(
            "Category can only be updated for persisted transactions.",
            "transactionId",
        ));
    }

    let suggested_category = existing_row.get::<String, _>("suggested_category");
    let previous_category = existing_row.get::<String, _>("final_category");
    let previous_source = existing_row.get::<String, _>("category_source");

    if previous_category == next_category {
        return Ok(UpdateCaptureCategoryResponse {
            transaction_id: payload.transaction_id,
            final_category: next_category,
            category_source: previous_source,
            audit_entry_id: 0,
        });
    }

    let next_source = if next_category == suggested_category {
        "suggested".to_string()
    } else {
        "user-override".to_string()
    };

    sqlx::query(
        "UPDATE capture_transactions SET final_category = $1, category_source = $2 WHERE id = $3 AND save_state = 'persisted'",
    )
    .bind(&next_category)
    .bind(&next_source)
    .bind(payload.transaction_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?;

    let audit_payload = json!({
        "transactionId": payload.transaction_id,
        "previousFinalCategory": previous_category,
        "nextFinalCategory": next_category,
        "categorySource": next_source
    });

    let audit_insert = sqlx::query(
        "INSERT INTO capture_audit_trail (capture_transaction_id, event_kind, payload_json) VALUES ($1, 'category_updated', $2)",
    )
    .bind(payload.transaction_id)
    .bind(audit_payload.to_string())
    .execute(&mut *transaction)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?;

    transaction
        .commit()
        .await
        .map_err(|error| CommandError::persistence(error.to_string()))?;

    Ok(UpdateCaptureCategoryResponse {
        transaction_id: payload.transaction_id,
        final_category: next_category,
        category_source: next_source,
        audit_entry_id: audit_insert.last_insert_rowid(),
    })
}

#[cfg(test)]
mod tests {
    use super::{
        create_account_with_pool,
        get_ledger_baseline_with_pool,
        update_capture_transaction_category_with_pool,
        CreateAccountRequest,
        UpdateCaptureCategoryRequest,
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

        sqlx::raw_sql(include_str!("../../migrations/0002_add_capture_transactions.sql"))
            .execute(&pool)
            .await
            .expect("capture migration to apply");

        sqlx::raw_sql(include_str!("../../migrations/0003_create_capture_audit_trail.sql"))
            .execute(&pool)
            .await
            .expect("audit migration to apply");

        sqlx::raw_sql(include_str!("../../migrations/0004_expand_capture_audit_history.sql"))
            .execute(&pool)
            .await
            .expect("audit expansion migration to apply");

        sqlx::raw_sql(include_str!("../../migrations/0005_add_transaction_categories.sql"))
            .execute(&pool)
            .await
            .expect("category migration to apply");

        pool
    }

    #[tokio::test]
    async fn creates_account_and_opening_balance_entry() {
        let pool = setup_pool().await;

        let created = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "HDFC".to_string(),
                account_number: "1234".to_string(),
                opening_balance_minor: 105099,
            },
        )
        .await
        .expect("account creation should succeed");

        let row = sqlx::query(
            "SELECT amount_minor, entry_kind FROM ledger_entries WHERE account_id = $1",
        )
        .bind(created.account_id)
        .fetch_one(&pool)
        .await
        .expect("opening balance entry to exist");

        assert_eq!(row.get::<i64, _>("amount_minor"), 105099);
        assert_eq!(row.get::<String, _>("entry_kind"), "opening_balance");
    }

    #[tokio::test]
    async fn rejects_duplicate_bank_and_account_number() {
        let pool = setup_pool().await;

        create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "ICICI".to_string(),
                account_number: "9999".to_string(),
                opening_balance_minor: 5000,
            },
        )
        .await
        .expect("first account creation should succeed");

        let duplicate_error = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "ICICI".to_string(),
                account_number: "9999".to_string(),
                opening_balance_minor: 1000,
            },
        )
        .await
        .expect_err("duplicate account should fail");

        assert_eq!(duplicate_error.code, "ACCOUNT_ALREADY_EXISTS");
    }

    #[tokio::test]
    async fn reads_ledger_baseline_after_account_creation() {
        let pool = setup_pool().await;

        let created = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "Axis".to_string(),
                account_number: "1010".to_string(),
                opening_balance_minor: 7000,
            },
        )
        .await
        .expect("account creation should succeed");

        let baseline = get_ledger_baseline_with_pool(&pool)
            .await
            .expect("baseline read should succeed");

        let account = baseline.account.expect("account should be present");
        assert_eq!(account.id, created.account_id);
        assert_eq!(account.bank_name, "Axis");
        assert_eq!(account.account_number, "1010");
        assert_eq!(account.current_balance_minor, 7000);
        assert_eq!(baseline.entries.len(), 1);
        assert_eq!(baseline.entries[0].entry_kind, "opening_balance");
        assert_eq!(baseline.ordering, "created_at_desc_id_desc");
    }

    #[tokio::test]
    async fn returns_explicit_empty_state_when_no_account_exists() {
        let pool = setup_pool().await;

        let baseline = get_ledger_baseline_with_pool(&pool)
            .await
            .expect("baseline read should succeed");

        assert!(baseline.account.is_none());
        assert!(baseline.entries.is_empty());
        assert!(baseline.category_insights.is_empty());
        assert!(baseline.merchant_insights.is_empty());
        assert_eq!(baseline.trend_alert.window_preset, "30d");
        assert!(!baseline.trend_alert.is_alert);
        assert!(baseline.running_balance.points.is_empty());
        assert_eq!(baseline.ordering, "created_at_desc_id_desc");
    }

    #[tokio::test]
    async fn computes_trend_alert_against_previous_window_baseline() {
        let pool = setup_pool().await;

        let account = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "HDFC Bank".to_string(),
                account_number: "XX1234".to_string(),
                opening_balance_minor: 100000,
            },
        )
        .await
        .expect("account should be created");

        sqlx::query(
            "INSERT INTO capture_transactions (account_id, transaction_fingerprint, raw_text, normalized_text, amount_minor, direction, transaction_date, bank_name, account_number, merchant_or_payee, suggested_category, final_category, category_source, mismatch_resolution, duplicate_decision, save_state, created_at) VALUES ($1, 'p-1', 'raw', 'raw', 1000, 'debit', '2026-02-20', 'HDFC Bank', 'XX1234', 'Cafe', 'dining', 'dining', 'suggested', 'none', 'none', 'persisted', '2026-02-20 09:00:00'), ($1, 'p-2', 'raw', 'raw', 1000, 'debit', '2026-02-25', 'HDFC Bank', 'XX1234', 'Cafe', 'dining', 'dining', 'suggested', 'none', 'none', 'persisted', '2026-02-25 09:00:00'), ($1, 'c-1', 'raw', 'raw', 3000, 'debit', '2026-03-20', 'HDFC Bank', 'XX1234', 'Store', 'shopping', 'shopping', 'suggested', 'none', 'none', 'persisted', '2026-03-20 09:00:00'), ($1, 'c-2', 'raw', 'raw', 3000, 'debit', '2026-03-25', 'HDFC Bank', 'XX1234', 'Store', 'shopping', 'shopping', 'suggested', 'none', 'none', 'persisted', '2026-03-25 09:00:00')",
        )
        .bind(account.account_id)
        .execute(&pool)
        .await
        .expect("capture transactions should insert");

        let baseline = get_ledger_baseline_with_pool(&pool)
            .await
            .expect("baseline read should succeed");

        assert_eq!(baseline.trend_alert.window_preset, "30d");
        assert_eq!(baseline.trend_alert.current_spend_minor, 7000);
        assert_eq!(baseline.trend_alert.baseline_spend_minor, 1000);
        assert!(baseline.trend_alert.delta_percent > 590.0);
        assert!(baseline.trend_alert.is_alert);
        assert!(baseline.trend_alert.reason.contains("above baseline"));
    }

    #[tokio::test]
    async fn builds_running_balance_points_in_stable_ascending_order() {
        let pool = setup_pool().await;

        let account = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "Axis".to_string(),
                account_number: "AB12".to_string(),
                opening_balance_minor: 10000,
            },
        )
        .await
        .expect("account should be created");

        sqlx::query("UPDATE ledger_entries SET created_at = '2026-04-30 09:00:00' WHERE account_id = $1")
            .bind(account.account_id)
            .execute(&pool)
            .await
            .expect("opening entry timestamp should be deterministic for running balance window");

        sqlx::query(
            "INSERT INTO capture_transactions (account_id, transaction_fingerprint, raw_text, normalized_text, amount_minor, direction, transaction_date, bank_name, account_number, merchant_or_payee, suggested_category, final_category, category_source, mismatch_resolution, duplicate_decision, save_state, created_at) VALUES ($1, 'fp-1', 'raw', 'raw', 500, 'debit', '2026-05-01', 'Axis', 'AB12', 'Metro', 'transport', 'transport', 'suggested', 'none', 'none', 'persisted', '2026-05-01 10:00:00'), ($1, 'fp-2', 'raw', 'raw', 2000, 'credit', '2026-05-02', 'Axis', 'AB12', 'Employer', 'salary', 'salary', 'suggested', 'none', 'none', 'persisted', '2026-05-02 10:00:00')",
        )
        .bind(account.account_id)
        .execute(&pool)
        .await
        .expect("capture transactions should insert");

        let baseline = get_ledger_baseline_with_pool(&pool)
            .await
            .expect("baseline read should succeed");

        assert_eq!(baseline.running_balance.window_preset, "30d");
        assert_eq!(baseline.running_balance.points.len(), 3);

        for window in baseline.running_balance.points.windows(2) {
            assert!(window[0].timestamp <= window[1].timestamp);
            if window[0].timestamp == window[1].timestamp {
                assert!(window[0].entry_id <= window[1].entry_id);
            }
        }

        assert_eq!(baseline.running_balance.points[0].balance_minor, 10000);
        assert_eq!(baseline.running_balance.points[1].delta_minor, -500);
        assert_eq!(baseline.running_balance.points[2].delta_minor, 2000);
        assert_eq!(baseline.running_balance.points[2].balance_minor, 11500);
    }

    #[tokio::test]
    async fn computes_category_and_merchant_insights_for_persisted_debits_only() {
        let pool = setup_pool().await;

        let account = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "HDFC Bank".to_string(),
                account_number: "XX1234".to_string(),
                opening_balance_minor: 10000,
            },
        )
        .await
        .expect("account should be created");

        let other_account = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "ICICI".to_string(),
                account_number: "YY9876".to_string(),
                opening_balance_minor: 5000,
            },
        )
        .await
        .expect("second account should be created");

        sqlx::query(
            "INSERT INTO capture_transactions (account_id, transaction_fingerprint, raw_text, normalized_text, amount_minor, direction, transaction_date, bank_name, account_number, merchant_or_payee, suggested_category, final_category, category_source, mismatch_resolution, duplicate_decision, save_state) VALUES ($1, 'fp-1', 'raw', 'raw', 5000, 'debit', '2026-05-01', 'HDFC Bank', 'XX1234', 'BigBazaar', 'groceries', 'groceries', 'suggested', 'none', 'none', 'persisted'), ($1, 'fp-2', 'raw', 'raw', 2500, 'debit', '2026-05-03', 'HDFC Bank', 'XX1234', 'BigBazaar', 'groceries', 'groceries', 'suggested', 'none', 'none', 'persisted'), ($1, 'fp-3', 'raw', 'raw', 7000, 'debit', '2026-05-04', 'HDFC Bank', 'XX1234', 'FuelHub', 'transport', 'transport', 'suggested', 'none', 'none', 'persisted'), ($1, 'fp-4', 'raw', 'raw', 6000, 'credit', '2026-05-06', 'HDFC Bank', 'XX1234', 'SalaryCo', 'salary', 'salary', 'suggested', 'none', 'none', 'persisted'), ($2, 'fp-5', 'raw', 'raw', 9900, 'debit', '2026-05-05', 'ICICI', 'YY9876', 'OtherMerchant', 'shopping', 'shopping', 'suggested', 'none', 'none', 'persisted')",
        )
        .bind(account.account_id)
        .bind(other_account.account_id)
        .execute(&pool)
        .await
        .expect("capture transactions should insert");

        let baseline = get_ledger_baseline_with_pool(&pool)
            .await
            .expect("baseline read should succeed");

        assert_eq!(baseline.category_insights.len(), 2);
        assert_eq!(baseline.category_insights[0].category_name, "groceries");
        assert_eq!(baseline.category_insights[0].total_amount_minor, 7500);
        assert_eq!(baseline.category_insights[0].transaction_count, 2);

        assert_eq!(baseline.category_insights[1].category_name, "transport");
        assert_eq!(baseline.category_insights[1].total_amount_minor, 7000);
        assert_eq!(baseline.category_insights[1].transaction_count, 1);

        assert!((baseline.category_insights[0].share_percent - 51.724137).abs() < 0.0001);
        assert!((baseline.category_insights[1].share_percent - 48.275862).abs() < 0.0001);

        assert_eq!(baseline.merchant_insights.len(), 2);
        assert_eq!(baseline.merchant_insights[0].merchant_or_payee, "BigBazaar");
        assert_eq!(baseline.merchant_insights[0].total_amount_minor, 7500);
        assert_eq!(baseline.merchant_insights[0].transaction_count, 2);
        assert_eq!(baseline.merchant_insights[0].last_seen_date.as_deref(), Some("2026-05-03"));

        assert_eq!(baseline.merchant_insights[1].merchant_or_payee, "FuelHub");
        assert_eq!(baseline.merchant_insights[1].total_amount_minor, 7000);
        assert_eq!(baseline.merchant_insights[1].transaction_count, 1);
        assert_eq!(baseline.merchant_insights[1].last_seen_date.as_deref(), Some("2026-05-04"));

        assert_eq!(baseline.insight_summary.len(), 3);
        assert_eq!(baseline.insight_summary[0].kind, "category");
        assert_eq!(baseline.insight_summary[1].kind, "merchant");
        assert_eq!(baseline.insight_summary[2].kind, "trend");
    }

    #[tokio::test]
    async fn builds_stable_empty_state_payloads_for_missing_insight_rows() {
        let pool = setup_pool().await;

        create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "Axis".to_string(),
                account_number: "AB12".to_string(),
                opening_balance_minor: 5000,
            },
        )
        .await
        .expect("account should be created");

        let baseline = get_ledger_baseline_with_pool(&pool)
            .await
            .expect("baseline read should succeed");

        assert_eq!(baseline.insight_summary.len(), 3);
        assert_eq!(baseline.insight_summary[0].kind, "category");
        assert!(baseline.insight_summary[0].is_empty);
        assert_eq!(
            baseline.insight_summary[0].empty_state.title,
            "No categorized transactions yet"
        );

        assert_eq!(baseline.insight_summary[1].kind, "merchant");
        assert!(baseline.insight_summary[1].is_empty);
        assert_eq!(
            baseline.insight_summary[1].empty_state.title,
            "No merchant activity yet"
        );

        assert_eq!(baseline.insight_summary[2].kind, "trend");
        assert!(baseline.insight_summary[2].is_empty);
        assert_eq!(
            baseline.insight_summary[2].empty_state.title,
            "Not enough history for a trend"
        );
    }

    #[tokio::test]
    async fn orders_merchant_insights_deterministically_with_tie_breakers() {
        let pool = setup_pool().await;

        let account = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "Axis".to_string(),
                account_number: "AB12".to_string(),
                opening_balance_minor: 100,
            },
        )
        .await
        .expect("account should be created");

        sqlx::query(
            "INSERT INTO capture_transactions (account_id, transaction_fingerprint, raw_text, normalized_text, amount_minor, direction, transaction_date, bank_name, account_number, merchant_or_payee, suggested_category, final_category, category_source, mismatch_resolution, duplicate_decision, save_state) VALUES ($1, 'fp-1', 'raw', 'raw', 5000, 'debit', '2026-05-01', 'Axis', 'AB12', 'Merchant B', 'shopping', 'shopping', 'suggested', 'none', 'none', 'persisted'), ($1, 'fp-2', 'raw', 'raw', 5000, 'debit', '2026-05-02', 'Axis', 'AB12', 'Merchant A', 'shopping', 'shopping', 'suggested', 'none', 'none', 'persisted'), ($1, 'fp-3', 'raw', 'raw', 5000, 'debit', '2026-05-03', 'Axis', 'AB12', 'Merchant A', 'shopping', 'shopping', 'suggested', 'none', 'none', 'persisted')",
        )
        .bind(account.account_id)
        .execute(&pool)
        .await
        .expect("capture transactions should insert");

        let baseline = get_ledger_baseline_with_pool(&pool)
            .await
            .expect("baseline read should succeed");

        assert_eq!(baseline.merchant_insights[0].merchant_or_payee, "Merchant A");
        assert_eq!(baseline.merchant_insights[0].transaction_count, 2);
        assert_eq!(baseline.merchant_insights[1].merchant_or_payee, "Merchant B");
        assert_eq!(baseline.merchant_insights[1].transaction_count, 1);
    }

    #[tokio::test]
    async fn orders_entries_deterministically_by_created_at_then_id_desc() {
        let pool = setup_pool().await;

        let created = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "SBI".to_string(),
                account_number: "2020".to_string(),
                opening_balance_minor: 100,
            },
        )
        .await
        .expect("account creation should succeed");

        sqlx::query("DROP INDEX idx_ledger_entries_account_entry_kind")
            .execute(&pool)
            .await
            .expect("unique index should be droppable for ordering test setup");

        sqlx::query(
            "INSERT INTO ledger_entries (account_id, entry_kind, amount_minor, created_at) VALUES ($1, 'opening_balance', 200, '2026-01-01 12:00:00')",
        )
        .bind(created.account_id)
        .execute(&pool)
        .await
        .expect("second entry should insert");

        sqlx::query(
            "INSERT INTO ledger_entries (account_id, entry_kind, amount_minor, created_at) VALUES ($1, 'opening_balance', 300, '2026-01-01 12:00:00')",
        )
        .bind(created.account_id)
        .execute(&pool)
        .await
        .expect("third entry should insert");

        let baseline = get_ledger_baseline_with_pool(&pool)
            .await
            .expect("baseline read should succeed");

        assert_eq!(baseline.entries.len(), 3);

        for window in baseline.entries.windows(2) {
            let left = &window[0];
            let right = &window[1];

            assert!(
                left.created_at > right.created_at
                    || (left.created_at == right.created_at && left.id > right.id)
            );
        }

        let tied_entries: Vec<_> = baseline
            .entries
            .iter()
            .filter(|entry| entry.created_at == "2026-01-01 12:00:00")
            .collect();

        assert_eq!(tied_entries.len(), 2);
        assert!(tied_entries[0].id > tied_entries[1].id);
    }

    #[tokio::test]
    async fn updates_capture_transaction_category_and_appends_audit_entry() {
        let pool = setup_pool().await;

        let account = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "HDFC Bank".to_string(),
                account_number: "XX1234".to_string(),
                opening_balance_minor: 10000,
            },
        )
        .await
        .expect("account should be created for capture transaction");

        sqlx::query(
            "INSERT INTO capture_transactions (account_id, transaction_fingerprint, raw_text, normalized_text, amount_minor, direction, transaction_date, bank_name, account_number, merchant_or_payee, suggested_category, final_category, category_source, mismatch_resolution, duplicate_decision, save_state) VALUES ($1, 'fp-1', 'raw', 'raw', 5000, 'debit', '2026-05-01', 'HDFC Bank', 'XX1234', 'BigBazaar', 'groceries', 'groceries', 'suggested', 'none', 'none', 'persisted')",
        )
        .bind(account.account_id)
        .execute(&pool)
        .await
        .expect("capture transaction insert should succeed");

        let update_result = update_capture_transaction_category_with_pool(
            &pool,
            UpdateCaptureCategoryRequest {
                transaction_id: 1,
                final_category: "shopping".to_string(),
            },
        )
        .await
        .expect("category update should succeed");

        assert_eq!(update_result.transaction_id, 1);
        assert_eq!(update_result.final_category, "shopping");
        assert_eq!(update_result.category_source, "user-override");

        let row = sqlx::query(
            "SELECT final_category, category_source FROM capture_transactions WHERE id = 1",
        )
        .fetch_one(&pool)
        .await
        .expect("capture transaction should exist");

        assert_eq!(row.get::<String, _>("final_category"), "shopping");
        assert_eq!(row.get::<String, _>("category_source"), "user-override");

        let audit_count = sqlx::query(
            "SELECT COUNT(*) AS count FROM capture_audit_trail WHERE capture_transaction_id = 1 AND event_kind = 'category_updated'",
        )
        .fetch_one(&pool)
        .await
        .expect("audit count query should succeed")
        .get::<i64, _>("count");

        assert_eq!(audit_count, 1);
    }

    #[tokio::test]
    async fn rejects_invalid_category_update_request() {
        let pool = setup_pool().await;

        let result = update_capture_transaction_category_with_pool(
            &pool,
            UpdateCaptureCategoryRequest {
                transaction_id: 1,
                final_category: "not-a-category".to_string(),
            },
        )
        .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn rejects_category_update_for_missing_transaction() {
        let pool = setup_pool().await;

        let result = update_capture_transaction_category_with_pool(
            &pool,
            UpdateCaptureCategoryRequest {
                transaction_id: 999,
                final_category: "shopping".to_string(),
            },
        )
        .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn no_op_category_update_does_not_append_audit_entry() {
        let pool = setup_pool().await;

        let account = create_account_with_pool(
            &pool,
            CreateAccountRequest {
                bank_name: "HDFC Bank".to_string(),
                account_number: "XX1234".to_string(),
                opening_balance_minor: 10000,
            },
        )
        .await
        .expect("account should be created for capture transaction");

        sqlx::query(
            "INSERT INTO capture_transactions (account_id, transaction_fingerprint, raw_text, normalized_text, amount_minor, direction, transaction_date, bank_name, account_number, merchant_or_payee, suggested_category, final_category, category_source, mismatch_resolution, duplicate_decision, save_state) VALUES ($1, 'fp-1', 'raw', 'raw', 5000, 'debit', '2026-05-01', 'HDFC Bank', 'XX1234', 'BigBazaar', 'groceries', 'groceries', 'suggested', 'none', 'none', 'persisted')",
        )
        .bind(account.account_id)
        .execute(&pool)
        .await
        .expect("capture transaction insert should succeed");

        let result = update_capture_transaction_category_with_pool(
            &pool,
            UpdateCaptureCategoryRequest {
                transaction_id: 1,
                final_category: "groceries".to_string(),
            },
        )
        .await
        .expect("no-op update should succeed");

        assert_eq!(result.audit_entry_id, 0);
        assert_eq!(result.category_source, "suggested");

        let audit_count = sqlx::query(
            "SELECT COUNT(*) AS count FROM capture_audit_trail WHERE capture_transaction_id = 1 AND event_kind = 'category_updated'",
        )
        .fetch_one(&pool)
        .await
        .expect("audit count query should succeed")
        .get::<i64, _>("count");

        assert_eq!(audit_count, 0);
    }
}

#[tauri::command]
pub async fn get_ledger_baseline(app: AppHandle) -> CommandEnvelope<LedgerBaselineResponse> {
    match ledger::sqlite_pool(&app).await {
        Ok(pool) => match get_ledger_baseline_with_pool(&pool).await {
            Ok(baseline) => CommandEnvelope {
                ok: true,
                data: Some(baseline),
                error: None,
            },
            Err(error) => error.into_envelope(),
        },
        Err(error) => CommandError::persistence(error).into_envelope(),
    }
}

pub(crate) async fn get_ledger_baseline_with_pool(
    pool: &Pool<Sqlite>,
) -> Result<LedgerBaselineResponse, CommandError> {
    let account_row = sqlx::query(
        "SELECT id, bank_name, account_number FROM accounts ORDER BY id ASC LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?;

    let Some(account_row) = account_row else {
        return Ok(LedgerBaselineResponse {
            account: None,
            entries: Vec::new(),
            category_insights: Vec::new(),
            merchant_insights: Vec::new(),
            trend_alert: TrendAlertSummary {
                window_preset: "30d",
                current_spend_minor: 0,
                baseline_spend_minor: 0,
                delta_percent: 0.0,
                threshold_percent: 20.0,
                is_alert: false,
                reason: "Not enough persisted debit history to compare trend windows."
                    .to_string(),
            },
            running_balance: RunningBalanceSummary {
                window_preset: "30d",
                points: Vec::new(),
            },
            insight_summary: Vec::new(),
            ordering: "created_at_desc_id_desc",
        });
    };

    let account_id = account_row.get::<i64, _>("id");
    let bank_name = account_row.get::<String, _>("bank_name");
    let account_number = account_row.get::<String, _>("account_number");

    let current_balance_minor = sqlx::query(
        "SELECT COALESCE(SUM(amount_minor), 0) AS current_balance_minor FROM (SELECT amount_minor FROM ledger_entries WHERE account_id = $1 UNION ALL SELECT CASE WHEN direction = 'debit' THEN -amount_minor ELSE amount_minor END AS amount_minor FROM capture_transactions WHERE account_id = $1 AND save_state = 'persisted')",
    )
    .bind(account_id)
    .fetch_one(pool)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?
    .get::<i64, _>("current_balance_minor");

    let entry_rows = sqlx::query(
        "SELECT id, entry_kind, amount_minor, created_at, capture_transaction_id, final_category, category_source FROM (SELECT id, entry_kind, amount_minor, created_at, NULL AS capture_transaction_id, NULL AS final_category, NULL AS category_source FROM ledger_entries WHERE account_id = $1 UNION ALL SELECT id, 'capture_transaction' AS entry_kind, CASE WHEN direction = 'debit' THEN -amount_minor ELSE amount_minor END AS amount_minor, created_at, id AS capture_transaction_id, final_category, category_source FROM capture_transactions WHERE account_id = $1) ORDER BY created_at DESC, id DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?;

    let entries = entry_rows
        .into_iter()
        .map(|row| LedgerEntrySummary {
            id: row.get::<i64, _>("id"),
            entry_kind: row.get::<String, _>("entry_kind"),
            amount_minor: row.get::<i64, _>("amount_minor"),
            created_at: row.get::<String, _>("created_at"),
            capture_transaction_id: row.get::<Option<i64>, _>("capture_transaction_id"),
            final_category: row.get::<Option<String>, _>("final_category"),
            category_source: row.get::<Option<String>, _>("category_source"),
        })
        .collect();

    let category_rows = sqlx::query(
        "SELECT final_category AS category_name, SUM(amount_minor) AS total_amount_minor, COUNT(*) AS transaction_count FROM capture_transactions WHERE account_id = $1 AND save_state = 'persisted' AND direction = 'debit' GROUP BY final_category ORDER BY total_amount_minor DESC, category_name ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?;

    let total_debit_minor: i64 = category_rows
        .iter()
        .map(|row| row.get::<i64, _>("total_amount_minor"))
        .sum();

    let category_insights: Vec<CategoryInsightSummary> = category_rows
        .into_iter()
        .map(|row| {
            let total_amount_minor = row.get::<i64, _>("total_amount_minor");
            let share_percent = if total_debit_minor > 0 {
                (total_amount_minor as f64 / total_debit_minor as f64) * 100.0
            } else {
                0.0
            };

            CategoryInsightSummary {
                category_name: row.get::<String, _>("category_name"),
                total_amount_minor,
                share_percent,
                transaction_count: row.get::<i64, _>("transaction_count"),
            }
        })
        .collect();

    let merchant_rows = sqlx::query(
        "SELECT merchant_or_payee, SUM(amount_minor) AS total_amount_minor, COUNT(*) AS transaction_count, MAX(transaction_date) AS last_seen_date FROM capture_transactions WHERE account_id = $1 AND save_state = 'persisted' AND direction = 'debit' GROUP BY merchant_or_payee ORDER BY total_amount_minor DESC, transaction_count DESC, merchant_or_payee ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?;

    let merchant_insights: Vec<MerchantInsightSummary> = merchant_rows
        .into_iter()
        .map(|row| MerchantInsightSummary {
            merchant_or_payee: row.get::<String, _>("merchant_or_payee"),
            total_amount_minor: row.get::<i64, _>("total_amount_minor"),
            transaction_count: row.get::<i64, _>("transaction_count"),
            last_seen_date: row.get::<Option<String>, _>("last_seen_date"),
        })
        .collect();

    let trend_alert = compute_trend_alert(pool, account_id).await?;
    let running_balance = compute_running_balance(pool, account_id).await?;
    let insight_summary = build_insight_summary_cards(
        &category_insights,
        &merchant_insights,
        &trend_alert,
    );

    Ok(LedgerBaselineResponse {
        account: Some(LedgerAccountSummary {
            id: account_id,
            bank_name,
            account_number,
            current_balance_minor,
        }),
        entries,
        category_insights,
        merchant_insights,
        trend_alert,
        running_balance,
        insight_summary,
        ordering: "created_at_desc_id_desc",
    })
}

fn build_insight_summary_cards(
    category_insights: &[CategoryInsightSummary],
    merchant_insights: &[MerchantInsightSummary],
    trend_alert: &TrendAlertSummary,
) -> Vec<InsightSummaryCard> {
    let category_card = if let Some(top_category) = category_insights.first() {
        InsightSummaryCard {
            kind: "category",
            title: "Category story".to_string(),
            headline: humanize_category_name(&top_category.category_name),
            metric_label: "Top category spend".to_string(),
            metric_value: format_minor_units(top_category.total_amount_minor),
            supporting_text: format!(
                "{} transactions account for {:.1}% of persisted debit spend.",
                top_category.transaction_count, top_category.share_percent
            ),
            badge_label: Some(format!("{:.1}% share", top_category.share_percent)),
            is_empty: false,
            empty_state: InsightCardEmptyState {
                title: "No categorized transactions yet".to_string(),
                detail: "There are no persisted debit transactions to summarize by category.".to_string(),
                next_action: "Save more categorized transactions to unlock this insight.".to_string(),
            },
        }
    } else {
        InsightSummaryCard {
            kind: "category",
            title: "Category story".to_string(),
            headline: "No category signal available".to_string(),
            metric_label: "Top category spend".to_string(),
            metric_value: format_minor_units(0),
            supporting_text: "Debit category concentration appears here after saves are committed.".to_string(),
            badge_label: None,
            is_empty: true,
            empty_state: InsightCardEmptyState {
                title: "No categorized transactions yet".to_string(),
                detail: "There are no persisted debit transactions to summarize by category.".to_string(),
                next_action: "Save more categorized transactions to unlock this insight.".to_string(),
            },
        }
    };

    let merchant_card = if let Some(top_merchant) = merchant_insights.first() {
        InsightSummaryCard {
            kind: "merchant",
            title: "Merchant story".to_string(),
            headline: top_merchant.merchant_or_payee.clone(),
            metric_label: "Top merchant spend".to_string(),
            metric_value: format_minor_units(top_merchant.total_amount_minor),
            supporting_text: match &top_merchant.last_seen_date {
                Some(last_seen) => format!(
                    "{} transactions. Last seen on {}.",
                    top_merchant.transaction_count, last_seen
                ),
                None => format!("{} transactions.", top_merchant.transaction_count),
            },
            badge_label: None,
            is_empty: false,
            empty_state: InsightCardEmptyState {
                title: "No merchant activity yet".to_string(),
                detail: "There are no eligible merchant rows in persisted debit history.".to_string(),
                next_action: "Save additional transactions to build merchant insights.".to_string(),
            },
        }
    } else {
        InsightSummaryCard {
            kind: "merchant",
            title: "Merchant story".to_string(),
            headline: "No merchant signal available".to_string(),
            metric_label: "Top merchant spend".to_string(),
            metric_value: format_minor_units(0),
            supporting_text: "Merchant concentration appears here after persisted debit activity.".to_string(),
            badge_label: None,
            is_empty: true,
            empty_state: InsightCardEmptyState {
                title: "No merchant activity yet".to_string(),
                detail: "There are no eligible merchant rows in persisted debit history.".to_string(),
                next_action: "Save additional transactions to build merchant insights.".to_string(),
            },
        }
    };

    let trend_has_window = trend_alert.baseline_spend_minor > 0;
    let trend_card = InsightSummaryCard {
        kind: "trend",
        title: "Trend story".to_string(),
        headline: trend_alert.reason.clone(),
        metric_label: "Window delta".to_string(),
        metric_value: format!("{:.1}%", trend_alert.delta_percent),
        supporting_text: format!(
            "Current {} vs baseline {} for preset {}.",
            format_minor_units(trend_alert.current_spend_minor),
            format_minor_units(trend_alert.baseline_spend_minor),
            trend_alert.window_preset
        ),
        badge_label: Some(if trend_alert.is_alert {
            "Alert".to_string()
        } else {
            "Stable".to_string()
        }),
        is_empty: !trend_has_window,
        empty_state: InsightCardEmptyState {
            title: "Not enough history for a trend".to_string(),
            detail: "A deterministic trend requires persisted debit data across baseline and current windows.".to_string(),
            next_action: "Save more categorized transactions in this preset window.".to_string(),
        },
    };

    vec![category_card, merchant_card, trend_card]
}

fn format_minor_units(value: i64) -> String {
    let sign = if value < 0 { "-" } else { "" };
    let absolute_minor = value.unsigned_abs();
    let major_units = absolute_minor / 100;
    let minor_units = absolute_minor % 100;
    format!(
        "{}INR {}.{:02}",
        sign,
        format_indian_grouping(major_units),
        minor_units
    )
}

fn format_indian_grouping(value: u64) -> String {
    let digits = value.to_string();
    if digits.len() <= 3 {
        return digits;
    }

    let split_at = digits.len() - 3;
    let head = &digits[..split_at];
    let tail = &digits[split_at..];

    let first_group_len = if head.len() % 2 == 0 { 2 } else { 1 };
    let mut grouped = String::new();
    grouped.push_str(&head[..first_group_len]);

    let mut index = first_group_len;
    while index < head.len() {
        grouped.push(',');
        grouped.push_str(&head[index..index + 2]);
        index += 2;
    }

    grouped.push(',');
    grouped.push_str(tail);
    grouped
}

fn humanize_category_name(raw: &str) -> String {
    raw.split('_')
        .filter(|segment| !segment.is_empty())
        .map(|segment| {
            let mut chars = segment.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<String>>()
        .join(" ")
}

async fn compute_trend_alert(
    pool: &Pool<Sqlite>,
    account_id: i64,
) -> Result<TrendAlertSummary, CommandError> {
    const WINDOW_PRESET: &str = "30d";
    const THRESHOLD_PERCENT: f64 = 20.0;

    let row = sqlx::query(
        "WITH latest AS (SELECT MAX(transaction_date) AS latest_date FROM capture_transactions WHERE account_id = $1 AND save_state = 'persisted' AND direction = 'debit'), windows AS (SELECT latest_date, date(latest_date, '-29 day') AS current_start, date(latest_date, '-59 day') AS baseline_start, date(latest_date, '-30 day') AS baseline_end FROM latest) SELECT COALESCE(SUM(CASE WHEN ct.transaction_date BETWEEN windows.current_start AND windows.latest_date THEN ct.amount_minor ELSE 0 END), 0) AS current_spend_minor, COALESCE(SUM(CASE WHEN ct.transaction_date BETWEEN windows.baseline_start AND windows.baseline_end THEN ct.amount_minor ELSE 0 END), 0) AS baseline_spend_minor, windows.latest_date AS latest_date FROM windows LEFT JOIN capture_transactions ct ON ct.account_id = $1 AND ct.save_state = 'persisted' AND ct.direction = 'debit'",
    )
    .bind(account_id)
    .fetch_one(pool)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?;

    let current_spend_minor = row.get::<i64, _>("current_spend_minor");
    let baseline_spend_minor = row.get::<i64, _>("baseline_spend_minor");
    let latest_date = row.get::<Option<String>, _>("latest_date");

    if latest_date.is_none() {
        return Ok(TrendAlertSummary {
            window_preset: WINDOW_PRESET,
            current_spend_minor: 0,
            baseline_spend_minor: 0,
            delta_percent: 0.0,
            threshold_percent: THRESHOLD_PERCENT,
            is_alert: false,
            reason: "Not enough persisted debit history to compare trend windows.".to_string(),
        });
    }

    let delta_percent = if baseline_spend_minor > 0 {
        ((current_spend_minor - baseline_spend_minor) as f64 / baseline_spend_minor as f64) * 100.0
    } else {
        0.0
    };

    let is_alert = baseline_spend_minor > 0 && delta_percent >= THRESHOLD_PERCENT;

    let reason = if baseline_spend_minor <= 0 {
        "Not enough persisted debit history to compare trend windows.".to_string()
    } else if is_alert {
        format!(
            "Current window spend is {:.1}% above baseline.",
            delta_percent
        )
    } else {
        format!(
            "Current window spend is {:.1}% versus baseline and below alert threshold.",
            delta_percent
        )
    };

    Ok(TrendAlertSummary {
        window_preset: WINDOW_PRESET,
        current_spend_minor,
        baseline_spend_minor,
        delta_percent,
        threshold_percent: THRESHOLD_PERCENT,
        is_alert,
        reason,
    })
}

async fn compute_running_balance(
    pool: &Pool<Sqlite>,
    account_id: i64,
) -> Result<RunningBalanceSummary, CommandError> {
    const WINDOW_PRESET: &str = "30d";

    let event_rows = sqlx::query(
        "SELECT id, entry_kind, delta_minor, event_date FROM (SELECT id, entry_kind, amount_minor AS delta_minor, date(created_at) AS event_date FROM ledger_entries WHERE account_id = $1 UNION ALL SELECT id, 'capture_transaction' AS entry_kind, CASE WHEN direction = 'debit' THEN -amount_minor ELSE amount_minor END AS delta_minor, transaction_date AS event_date FROM capture_transactions WHERE account_id = $1 AND save_state = 'persisted') ORDER BY event_date ASC, id ASC, entry_kind ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?;

    if event_rows.is_empty() {
        return Ok(RunningBalanceSummary {
            window_preset: WINDOW_PRESET,
            points: Vec::new(),
        });
    }

    let max_event_date = event_rows
        .last()
        .map(|row| row.get::<String, _>("event_date"))
        .unwrap_or_default();

    let cutoff_date = sqlx::query("SELECT date($1, '-29 day') AS cutoff")
        .bind(&max_event_date)
        .fetch_one(pool)
        .await
        .map_err(|error| CommandError::persistence(error.to_string()))?
        .get::<String, _>("cutoff");

    let mut running_balance_minor = 0_i64;
    let mut points = Vec::new();

    for row in event_rows {
        let timestamp = row.get::<String, _>("event_date");
        let delta_minor = row.get::<i64, _>("delta_minor");
        let entry_id = row.get::<i64, _>("id");
        let entry_kind = row.get::<String, _>("entry_kind");

        running_balance_minor += delta_minor;

        if timestamp >= cutoff_date {
            points.push(RunningBalancePoint {
                timestamp,
                balance_minor: running_balance_minor,
                delta_minor,
                entry_id,
                entry_kind,
            });
        }
    }

    Ok(RunningBalanceSummary {
        window_preset: WINDOW_PRESET,
        points,
    })
}