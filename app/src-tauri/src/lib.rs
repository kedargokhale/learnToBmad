mod commands;
mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sql_plugin = tauri_plugin_sql::Builder::default()
        .add_migrations(db::ledger::DATABASE_URL, db::ledger::migrations())
        .build();

    tauri::Builder::default()
        .plugin(sql_plugin)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![commands::ledger::create_account])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
