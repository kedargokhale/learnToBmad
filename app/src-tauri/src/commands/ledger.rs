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
    pub ordering: &'static str,
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

#[cfg(test)]
mod tests {
    use super::{create_account_with_pool, get_ledger_baseline_with_pool, CreateAccountRequest};
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
        assert_eq!(baseline.ordering, "created_at_desc_id_desc");
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

async fn get_ledger_baseline_with_pool(
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
            ordering: "created_at_desc_id_desc",
        });
    };

    let account_id = account_row.get::<i64, _>("id");
    let bank_name = account_row.get::<String, _>("bank_name");
    let account_number = account_row.get::<String, _>("account_number");

    let current_balance_minor = sqlx::query(
        "SELECT COALESCE(SUM(amount_minor), 0) AS current_balance_minor FROM ledger_entries WHERE account_id = $1",
    )
    .bind(account_id)
    .fetch_one(pool)
    .await
    .map_err(|error| CommandError::persistence(error.to_string()))?
    .get::<i64, _>("current_balance_minor");

    let entry_rows = sqlx::query(
        "SELECT id, entry_kind, amount_minor, created_at FROM ledger_entries WHERE account_id = $1 ORDER BY created_at DESC, id DESC",
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
        })
        .collect();

    Ok(LedgerBaselineResponse {
        account: Some(LedgerAccountSummary {
            id: account_id,
            bank_name,
            account_number,
            current_balance_minor,
        }),
        entries,
        ordering: "created_at_desc_id_desc",
    })
}