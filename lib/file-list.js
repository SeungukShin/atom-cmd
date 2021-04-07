'use babel';

const fs = require('fs');
const path = require('path');
const fastFolderSize = require('fast-folder-size');

class FileItem {
	/**
	 * @property {String} uri
	 * @property {fs.Dirent} dirent
	 * @property {fs.Stats} stats
	 * @property {Number} size
	 * @property {Boolean} select
	 * @property {Promise} promiseStats
	 * @property {Promise} promiseSize
	 */

	/**
	 * @constructor
	 * @param {String} cwd
	 * @param {fs.Dirent} dirent
	 * @returns {FileItem}
	 */
	constructor(cwd, dirent) {
		this.uri = path.normalize(path.join(cwd, dirent.name));
		this.dirent = dirent;
		this.stats = null;
		this.size = -1;
		this.select = false;
		this.promiseStats = this.getNewStats();
		this.promiseSize = null;
	}

	async getNewStats() {
		return fs.promises.stat(this.uri).then((stats) => {
			this.stats = stats;
			if (!this.dirent.isDirectory()) {
				this.size = stats.size;
			}
		});
	}

	/**
	 * @param {Boolean} force
	 * @returns {Promise<void>}
	 */
	async update(force = false) {
		if (!force) {
			return this.promiseStats;
		}
		return new Promise(async (resolve/*, reject*/) => {
			this.promiseStats.then(() => {
				this.promiseStats = this.getNewStats();
				this.promiseStats.then(() => {
					resolve();
				});
			});
		});
	}

	/**
	 * @returns {String}
	 */
	getUri() {
		return this.uri;
	}

	/**
	 * @returns {fs.Dirent}
	 */
	getDirent() {
		return this.dirent;
	}

	/**
	 * @returns {Promise<fs.Stats>}
	 */
	async getStats() {
		return new Promise(async (resolve/*, reject*/) => {
			this.promiseStats.then(() => {
				resolve(this.stats);
			});
		});
	}

	/**
	 * @returns {Boolean}
	 */
	getSelect() {
		return this.select;
	}

	/**
	 * @param {Boolean} select
	 * @returns {void}
	 */
	setSelect(select) {
		this.select = select;
	}

	/**
	 * @returns {Promise<Number>}
	 */
	async getSize() {
		if (this.size > 0) {
			return Promise.resolve(this.size);
		}
		return new Promise(async (resolve/*, reject*/) => {
			if (!this.dirent.isDirectory()) {
				this.promiseStats.then(() => {
					resolve(this.stats.size);
				});
			} else {
				fastFolderSize(this.uri, (err, bytes) => {
					if (err) {
						throw err;
					}
					this.size = bytes;
					resolve(bytes);
				});
			}
		});
	}
}

class FileList {
	/**
	 * @property {String} cwd
	 * @property {FileItem[]} fileItems
	 * @property {Promise} promiseFileItems
	 *
	 * @property {Number} active
	 * @property {Number} totalFiles
	 * @property {Number} selectFiles
	 * @property {Number} totalDirectories
	 * @property {Number} selectDirectories
	 * @property {Number} totalSize
	 * @property {Number} selectSize
	 */

	/**
	 * @constructor
	 * @param {String} cwd
	 * @returns {FileList}
	 */
	constructor(cwd) {
		if (!path.isAbsolute(cwd)) {
			throw new Error('need an absolute path:', cwd);
		}
		const stats = fs.statSync(cwd);
		if (!stats.isDirectory()) {
			cwd = path.dirname(cwd);
		}
		this.cwd = path.normalize(cwd);
		this.fileItems = null;
		this.active = 0;
		this.totalFiles = 0;
		this.selectFiles = 0;
		this.totalDirectories = 0;
		this.selectDirectories = 0;
		this.totalSize = 0;
		this.selectSize = 0;
		this.promiseFileItems = this.getNewFileItems();
	}

	async getNewFileItems() {
		return fs.promises.readdir(this.cwd, { withFileTypes: true }).then((dirents) => {
			const fileItems = [];
			fileItems.length = dirents.length + 2;
			fileItems[0] = new FileItem(this.cwd, new fs.Dirent('.', 2));
			fileItems[1] = new FileItem(this.cwd, new fs.Dirent('..', 2));
			for (const i in dirents) {
				fileItems[parseInt(i) + 2] = new FileItem(this.cwd, dirents[i]);
			}
			this.fileItems = fileItems;
			for (const fileItem of this.fileItems) {
				const dirent = fileItem.getDirent();
				if (dirent.isDirectory()) {
					this.totalDirectories++;
				} else {
					this.totalFiles++;
					fileItem.getSize().then((size) => {
						this.totalSize += size;
					});
				}
			}
		});
	}

	/**
	 * @returns {Promise<void>}
	 */
	async destroy() {
	}

	/**
	 * @param {Boolean} force
	 * @returns {Promise<void>}
	 */
	async update(force = false) {
		if (!force) {
			return this.promiseFileItems;
		}
		return new Promise(async (resolve/*, reject*/) => {
			this.promiseFileItems.then(() => {
				this.promiseFileItems = this.getNewFileItems();
				this.promiseFileItems.then(() => {
					resolve();
				});
			});
		});
	}

	/**
	 * @returns {Promise<void>}
	 */
	async wait() {
		return new Promise(async (resolve/*, reject*/) => {
			this.promiseFileItems.then(() => {
				const promises = [];
				for (const fileItem of this.fileItems) {
					promises.push(fileItem.getStats());
				}
				Promise.all(promises).then(() => {
					resolve();
				});
			});
		});
	}

	/**
	 * @returns {String}
	 */
	getDirectory() {
		return this.cwd;
	}

	/**
	 * @returns {Number}
	 */
	getActive() {
		return this.active;
	}

	/**
	 * @param {Number} active
	 * @returns {void}
	 */
	setActive(active) {
		this.active = active;
	}

	/**
	 * @returns {Promise<FileItem[]>}
	 */
	async getFileItems() {
		return new Promise(async (resolve/*, reject*/) => {
			this.promiseFileItems.then(() => {
				resolve(this.fileItems);
			});
		});
	}

	/**
	 * @returns {FileItem}
	 */
	getActiveFileItem() {
		return this.fileItems[this.active];
	}

	/**
	 * @returns {FileItem[]}
	 */
	getSelectFileItems() {
		const items = [];
		for (const fileItem of this.fileItems) {
			if (fileItem.getSelect()) {
				items.push(fileItem);
			}
		}
		return items;
	}

	/**
	 * @param {FileItem} fileItem
	 * @param {Boolean} select
	 * @returns {Promise<void>}
	 */
	async setSelect(fileItem, select) {
		return new Promise(async (resolve/*, reject*/) => {
			fileItem.setSelect(select);
			const dirent = fileItem.getDirent();
			if (dirent.isDirectory()) {
				if (select) {
					this.selectDirectories++;
				} else {
					this.selectDirectories--;
				}
			} else {
				if (select) {
					this.selectFiles++;
				} else {
					this.selectFiles--;
				}
			}
			fileItem.getSize().then((size) => {
				if (select) {
					this.selectSize += size;
				} else {
					this.selectSize -= size;
				}
				resolve();
			})
		});
	}

	async sort(dirFirst, type, ascending) {
		return new Promise(async (resolve/*, reject*/) => {
			if (type === 'name' || type === 'ext') {
				this.promiseFileItems.then(() => {
					this.fileItems.sort((a, b) => {
						if (dirFirst) {
							if (a.dirent.isDirectory() && !b.dirent.isDirectory()) {
								return -1;
							} else if (!a.dirent.isDirectory() && b.dirent.isDirectory()) {
								return 1;
							}
						}
						if (type === 'name') {
							if (ascending) {
								if (a.dirent.name <= b.dirent.name) {
									return -1;
								} else {
									return 1;
								}
							} else {
								if (a.dirent.name <= b.dirent.name) {
									return 1;
								} else {
									return -1;
								}
							}
						} else {
							if (ascending) {
								if (path.extname(a.dirent.name) <= path.extname(b.dirent.name)) {
									return -1;
								} else {
									return 1;
								}
							} else {
								if (path.extname(a.dirent.name) <= path.extname(b.dirent.name)) {
									return 1;
								} else {
									return -1;
								}
							}
						}
					});
				});
			} else {
				this.wait().then(() => {
					this.fileItems.sort((a, b) => {
						if (dirFirst) {
							if (a.dirent.isDirectory() && !b.dirent.isDirectory()) {
								return -1;
							} else if (!a.dirent.isDirectory() && b.dirent.isDirectory()) {
								return 1;
							}
						}
						if (type === 'date') {
							if (ascending) {
								if (a.stats.mtime <= b.stats.mtime) {
									return -1;
								} else {
									return 1;
								}
							} else {
								if (a.stats.mtime <= b.stats.mtime) {
									return 1;
								} else {
									return -1;
								}
							}
						} else {
							if (ascending) {
								if (a.stats.mode <= b.stats.mode) {
									return -1;
								} else {
									return 1;
								}
							} else {
								if (a.stats.mode <= b.stats.mode) {
									return 1;
								} else {
									return -1;
								}
							}
						}
					});
				});
			}
			resolve();
		});
	}
}

class FileListCache {
	/**
	 * @property {Number} size
	 * @property {Map[String] -> [FileList, Number]} map
	 * @property {String} queue
	 */

	/**
	 * @constructor
	 * @param {Number} size
	 * @returns {FileListCache}
	 */
	constructor(size) {
		this.size = size;
		this.map = new Map();
		this.queue = [];
	}

	/**
	 * @param {String} cwd
	 * @returns {FileList}
	 */
	getFileList(cwd) {
		if (this.map.has(cwd)) {
			const [fileList, count] = this.map.get(cwd);
			this.map.set(cwd, [fileList, count + 1]);
			this.queue.push(cwd);
			return fileList;
		}
		while (this.map.size > this.size) {
			const dir = this.queue.shift();
			const [fileList, count] = this.map.get(dir);
			if (count > 1) {
				this.map.set(dir, [fileList, count - 1]);
			} else {
				this.map.delete(dir);
			}
		}
		const fileList = new FileList(cwd);
		this.map.set(cwd, [fileList, 1]);
		this.queue.push(cwd);
		return fileList;
	}
}

module.exports = {
	FileItem,
	FileList,
	FileListCache
}
