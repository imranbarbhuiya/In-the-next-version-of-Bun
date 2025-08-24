import './setup';

const formatSize = (bytes: number): string => {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(1)}${units[unitIndex]}`;
};

const FOLDER = './';
const PATH_DEPTH = FOLDER.split('/').length;
// your code - example du-like program, inline rust...
const du = await Bun.Rust`
  // cargo-deps: walkdir = "2"
  use walkdir::WalkDir;
  use std::collections::HashMap;
  use std::fs;
  use std::path::Path;

  let mut dir_sizes: HashMap<String, u64> = HashMap::new();
  let target_depth = 1;
  
  for entry in WalkDir::new("${FOLDER}") {
    let Ok(entry) = entry else { continue };
    let path = entry.path();
    
    if path.is_file() {
      if let Ok(metadata) = fs::metadata(path) {
        let size = metadata.len();
        let mut current_path = path;
        
        while let Some(parent) = current_path.parent() {
          let parent_str = parent.to_string_lossy().to_string();
          let relative_depth = parent.components().count() - ${PATH_DEPTH};
          
          if relative_depth <= target_depth {
            *dir_sizes.entry(parent_str.clone()).or_insert(0) += size;
          }
          
          current_path = parent;
          if parent_str == "${FOLDER}" { break; }
        }
      }
    }
  }
  
  let mut entries: Vec<(String, u64)> = dir_sizes
    .into_iter()
    .filter(|(path, _)| Path::new(path).components().count() - ${PATH_DEPTH} <= target_depth)
    .collect();
  
  entries.sort_by(|a, b| b.1.cmp(&a.1));
  Ok::<Vec<(String, u64)>, String>(entries)
`;

// "result" type in typescript!
const val = du.unwrap<[string, number][]>();

// formattign...
const formattedEntries = val.reverse().map((v) => ({
	path: v[0],
	sizeStr: formatSize(v[1]),
}));

const maxSizeWidth = Math.max(...formattedEntries.map((e) => e.sizeStr.length));

console.log(formattedEntries.map((v) => `${v.sizeStr.padEnd(maxSizeWidth)}  ${v.path}`).join('\n'));
