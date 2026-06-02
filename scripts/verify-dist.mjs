import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(process.cwd());
const packagesRoot = path.join(projectRoot, 'packages');

function isDirectory(p) {
	try {
		return statSync(p).isDirectory();
	} catch {
		return false;
	}
}

function listFilesRecursive(dir) {
	const out = [];
	const entries = readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const abs = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...listFilesRecursive(abs));
		} else if (entry.isFile()) {
			out.push(abs);
		}
	}
	return out;
}

function sha256File(absPath) {
	const data = readFileSync(absPath);
	return createHash('sha256').update(data).digest('hex');
}

function snapshotDist() {
	/** @type {Map<string, string>} */
	const snapshot = new Map();
	if (!isDirectory(packagesRoot)) {
		return snapshot;
	}

	for (const pkgName of readdirSync(packagesRoot)) {
		const distDir = path.join(packagesRoot, pkgName, 'dist');
		if (!isDirectory(distDir)) {
			continue;
		}
		for (const abs of listFilesRecursive(distDir)) {
			const rel = path.relative(projectRoot, abs);
			snapshot.set(rel, sha256File(abs));
		}
	}
	return snapshot;
}

function diffSnapshots(before, after) {
	const allKeys = new Set([...before.keys(), ...after.keys()]);
	const changed = [];
	const added = [];
	const removed = [];

	for (const key of Array.from(allKeys).sort()) {
		const b = before.get(key);
		const a = after.get(key);
		if (b == null && a != null) {
			added.push(key);
		} else if (b != null && a == null) {
			removed.push(key);
		} else if (b !== a) {
			changed.push(key);
		}
	}
	return { changed, added, removed };
}

function main() {
	const before = snapshotDist();

	const result = spawnSync('npm', ['run', 'build'], {
		cwd: projectRoot,
		stdio: 'inherit',
		shell: false,
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}

	const after = snapshotDist();
	const diff = diffSnapshots(before, after);

	if (diff.changed.length === 0 && diff.added.length === 0 && diff.removed.length === 0) {
		console.log('verify:dist OK (packages/*/dist unchanged after build)');
		return;
	}

	console.error('verify:dist FAILED: packages/*/dist changed after build.');
	if (diff.added.length) {
		console.error(`\nAdded (${diff.added.length}):`);
		diff.added.forEach((p) => console.error(`  + ${p}`));
	}
	if (diff.removed.length) {
		console.error(`\nRemoved (${diff.removed.length}):`);
		diff.removed.forEach((p) => console.error(`  - ${p}`));
	}
	if (diff.changed.length) {
		console.error(`\nChanged (${diff.changed.length}):`);
		diff.changed.forEach((p) => console.error(`  * ${p}`));
	}

	console.error('\nThis indicates dist was modified without updating the TS source, or build outputs are not committed.');
	console.error('Fix by updating source and re-running: npm run build');
	process.exit(1);
}

main();
