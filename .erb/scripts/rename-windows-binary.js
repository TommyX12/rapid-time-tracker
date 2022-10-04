import glob from 'glob';
import fs from 'fs';

glob('release/build/*.exe', (err, files) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  files.forEach((path) => {
    const newPath = path.replaceAll(' ', '.');
    fs.renameSync(path, newPath);
  });
});
