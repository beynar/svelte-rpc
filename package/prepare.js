import esbuild from 'esbuild';
import path from 'path';
import dir from 'node-dir';

function minifyFile(inputFile, outputFile) {
	esbuild
		.build({
			entryPoints: [inputFile],
			outfile: outputFile,
			allowOverwrite: true,
			minify: true
		})
		.catch(() => process.exit(1));
}

function mangleFilesInFolders(dirPath) {
	dir.files(dirPath, function (err, files) {
		if (err) throw err;
		files.forEach(function (filePath) {
			var ext = path.extname(filePath || '').split('.');
			var ext = ext[ext.length - 1];
			if (ext === 'js' && !filePath.includes('.min.js')) {
				var newPath = filePath;
				minifyFile(filePath, newPath);
			}
		});
	});
}

// fs.rmSync('./dist/types.js');
// fs.writeFileSync('./dist/index.js', `"use strict";export*from"./server.js";`);
mangleFilesInFolders('./dist');
