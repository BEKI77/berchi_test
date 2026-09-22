fn main() {
    // The salon's deployed address is baked in at build time (see
    // BAKED_IN_SALON_URL in src/lib.rs). Without this, changing it would not
    // rebuild anything and the old address would quietly survive.
    println!("cargo:rerun-if-env-changed=BERCHI_DEFAULT_URL");
    tauri_build::build()
}
