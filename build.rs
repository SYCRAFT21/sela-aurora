use std::{env, fs, path::Path};

fn collect(root: &Path, directory: &Path, entries: &mut Vec<String>) {
    let mut paths: Vec<_> = fs::read_dir(directory).expect("frontend assets missing; run npm --prefix frontend run build").map(|entry| entry.unwrap().path()).collect();
    paths.sort();
    for path in paths {
        if path.is_dir() { collect(root, &path, entries); }
        else if path.is_file() && !path.is_symlink() {
            let name = path.strip_prefix(root).unwrap().to_str().unwrap().replace('\\', "/");
            let absolute = path.canonicalize().unwrap();
            entries.push(format!("({name:?}, include_bytes!({:?}) as &'static [u8]),", absolute.to_str().unwrap()));
        }
    }
}
fn main() {
    println!("cargo:rerun-if-changed=src/aurora-dist");
    let mut entries = Vec::new();
    collect(Path::new("src/aurora-dist"), Path::new("src/aurora-dist"), &mut entries);
    fs::write(Path::new(&env::var("OUT_DIR").unwrap()).join("assets.rs"), format!("static EMBEDDED_ASSETS: &[(&str, &[u8])] = &[{}];", entries.join("\n"))).unwrap();
}
