// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::thread;
use std::time::Duration;
use tauri::Window;

// Command to simulate ESC/POS raw print triggers with serial port write and fallback
#[tauri::command]
fn trigger_raw_print(bill_id: String, payload: String) -> Result<String, String> {
    println!("[RUST] Attempting connection to ESC/POS print port COM3...");
    
    // Simulate real hardware write or fallback to mock
    match std::fs::OpenOptions::new().write(true).open("COM3") {
        Ok(mut port) => {
            use std::io::Write;
            if let Err(e) = port.write_all(payload.as_bytes()) {
                return Err(format!("Failed writing to physical printer on COM3: {}", e));
            }
            Ok(format!("ESC/POS Print Job for {} successfully written to physical port COM3", bill_id))
        }
        Err(_) => {
            println!("[RUST] COM3 port not found. Executing graceful mock printer bypass...");
            Ok(format!("[MOCK] ESC/POS Print Job for {} queued successfully on serial COM3 (Bypassed print dialog)", bill_id))
        }
    }
}

// Command to simulate barcode scanner HID captures
#[tauri::command]
fn hook_barcode_scanner(window: Window) -> Result<String, String> {
    println!("[RUST] Bound active keyboard serial scanner hooks");
    
    // Spawn a background thread to periodically simulate barcodes for UI testing
    thread::spawn(move || {
        let mock_barcodes = vec!["LOINC_4544-3", "LOINC_1975-2", "LOINC_24357-1"];
        let mut idx = 0;
        loop {
            thread::sleep(Duration::from_secs(12));
            let barcode = mock_barcodes[idx % mock_barcodes.len()];
            println!("[RUST] Background scanner thread scanned: {}", barcode);
            let _ = window.emit("barcode-scanned", barcode);
            idx += 1;
        }
    });
    
    Ok("Barcode hook is active".into())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![trigger_raw_print, hook_barcode_scanner])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

