// Keeps the console window from opening behind the app on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    berchi_cashier_lib::run()
}
