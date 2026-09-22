fn main() {
    // The salon's deployed address is baked in at build time (see
    // BAKED_IN_SALON_URL in src/lib.rs). Without this, changing it would not
    // rebuild anything and the old address would quietly survive.
    println!("cargo:rerun-if-env-changed=BERCHI_DEFAULT_URL");

    // Naming the commands here generates an `allow-<command>` permission for
    // each, which is what capabilities/desktop.json and the run-time permission
    // in printing::salon_capability are written in terms of.
    //
    // It also turns ACL checking on for this program's own commands, so one that
    // is missing from this list cannot be called at all -- not even by the
    // program's own screens. Add the command here when you add one.
    let attributes = tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "list_printers",
            "printer_settings",
            "save_printer_settings",
            "preview_ticket",
            "test_print",
            "print_slip",
            "print_receipt",
            "open_cash_drawer",
            "printing_status",
            "open_printer_settings",
        ]),
    );

    tauri_build::try_build(attributes).expect("failed to build the Berchi cashier")
}
