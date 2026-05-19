use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_sql::{DbInstances, DbPool, Migration, MigrationKind};

pub const DATABASE_URL: &str = "sqlite:ledger.db";

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_accounts_and_ledger_entries",
        sql: include_str!("../../migrations/0001_create_accounts_and_ledger_entries.sql"),
        kind: MigrationKind::Up,
    }, Migration {
        version: 2,
        description: "add_capture_transactions",
        sql: include_str!("../../migrations/0002_add_capture_transactions.sql"),
        kind: MigrationKind::Up,
    }, Migration {
        version: 3,
        description: "create_capture_audit_trail",
        sql: include_str!("../../migrations/0003_create_capture_audit_trail.sql"),
        kind: MigrationKind::Up,
    }]
}

pub async fn sqlite_pool<R: Runtime>(app: &AppHandle<R>) -> Result<Pool<Sqlite>, String> {
    let instances = app.state::<DbInstances>();
    let lock = instances.0.read().await;

    match lock.get(DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        None => Err("Ledger database was not initialized".to_string()),
    }
}