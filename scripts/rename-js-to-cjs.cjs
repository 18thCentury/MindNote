const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, '../dist-electron/electron');

fs.readdir(directory, (err, files) => {
  if (err) {
    console.error('Error reading directory:', err);
    return;
  }

  files.forEach(file => {
    if (file.endsWith('.js')) {
      const oldPath = path.join(directory, file);
      const newPath = path.join(directory, file.replace('.js', '.cjs'));
      fs.rename(oldPath, newPath, err => {
        if (err) {
          console.error(`Error renaming ${oldPath} to ${newPath}:`, err);
        } else {
          console.log(`Renamed ${oldPath} to ${newPath}`);
        }
      });
    }
  });
});
