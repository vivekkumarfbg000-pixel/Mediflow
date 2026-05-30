// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Command to simulate ESC/POS raw print triggers
#[tauri::command]
fn trigger_raw_print(bill_id: String, payload: String) -> Result<String, String> {
    println!("[RUST] Dispatched ESC/POS job for Bill {} to COM3: {}", bill_id, payload);
    Ok(format!("ESC/POS Print Job for {} queued successfully on serial COM3", bill_id))
}

// Command to simulate barcode scanner HID captures
#[tauri::command]
fn hook_barcode_scanner() -> Result<String, String> {
    println!("[RUST] Bound active keyboard serial scanner hooks");
    Ok("Barcode hook is active".into())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![trigger_raw_print, hook_barcode_scanner])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
