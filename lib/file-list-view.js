'use babel';

const fs = require('fs');
const path = require('path');
const disk = require('diskusage-ng');
const { CompositeDisposable } = require('atom');
const { FileListCache } = require('./file-list');
const AtomTable = require('./atom-table');

class FileListView {
	/**
	 * @property {CompositeDisposable} disposables
	 * @property {String} cwd
	 * @property {FileListCache} fileListCache
	 * @property {FileList} fileList
	 * @property {FileItem[]} fileItems
	 *
	 * @property {CompositeDisposable} icons
	 * @property {Function} addIconToElement
	 * @property {Function} updateFocus
	 *
	 * @property {Element} element
	 * @property {Element} disk
	 * @property {Element} prog - Progress of disk usage
	 * @property {Element} usage - Disk usage
	 * @property {Element} path
	 * @property {Element} status
	 */

	/**
	 * @constructor
	 * @param {String} cwd
	 * @param {FileListCache} fileListCache
	 * @param {Function} addIconToElement
	 * @param {Function} updateFocus
	 * @returns {FileListView}
	 */
	constructor(cwd, fileListCache, addIconToElement, updateFocus) {
		this.disposables = new CompositeDisposable();
		this.cwd = cwd;
		this.fileListCache = fileListCache;

		this.icons = new CompositeDisposable();
		this.addIconToElement = addIconToElement;
		this.updateFocus = updateFocus;

		// Element
		this.element = document.createElement('div');
		this.element.style.flex = 1;
		this.element.style.display = 'flex';
		this.element.style.flexDirection = 'column';
		this.element.style.alignItems = 'stretch';
		this.element.style.height = '100%';
		this.element.style.borderStyle = 'solid';
		this.element.style.borderWidth = '1px';
		this.element.style.borderColor = getComputedStyle(document.body).backgroundColor;
		this.element.classList.add('atom-cmd');

		// Disk usage
		this.disk = document.createElement('div');
		this.disk.classList.add('block');
		this.disk.style.display = 'flex';
		this.disk.style.flexDirection = 'row';
		this.disk.style.alignItems = 'center';
		this.disk.style.paddingLeft = '16px';
		this.disk.style.paddingRight = '16px';
		this.disk.style.paddingTop = '16px';
		this.prog = document.createElement('progress');
		this.prog.classList.add('inline-block');
		this.prog.style.flex = 1;
		this.disk.appendChild(this.prog);
		this.usage = document.createElement('span');
		this.usage.classList.add('inline-block');
		this.usage.innerText = 'Calculating...';
		this.disk.appendChild(this.usage);
		this.element.appendChild(this.disk);

		// Path
		this.path = document.createElement('div');
		this.path.innerText = 'path';
		this.path.style.paddingLeft = '8px';
		this.path.style.paddingRight = '8px';
		this.element.appendChild(this.path);

		// Table
		this.heads = ['name', 'ext', 'size', 'date', 'attr'];
		this.table = new AtomTable({
			heads: this.heads,
			bodys: [],
			active: null,
			headRenderer: this.headRenderer.bind(this),
			headLeftClick: this.headLeftClick.bind(this),
			headRightClick: this.headRightClick.bind(this),
			bodyRenderer: this.bodyRenderer.bind(this),
			bodyLeftClick: this.bodyLeftClick.bind(this),
			bodyRightClick: this.bodyRightClick.bind(this),
			bodyDoubleClick: this.bodyDoubleClick.bind(this)
		});
		this.element.appendChild(this.table.element);
		this.table.element.addEventListener('focus', (event) => {
			console.log('event');
			console.log(event);
		});

		// Status
		this.status = document.createElement('div');
		this.status.innerText = 'status';
		this.status.style.paddingLeft = '8px';
		this.status.style.paddingRight = '8px';
		this.status.style.marginTop = 'auto';
		this.element.appendChild(this.status);
	}

	/**
	 * @returns {void}
	 */
	destroy() {
		this.disposables.dispose();
		this.icons.dispose();
		this.table.destroy();
	}

	/***************************************************************************
	 * Action
	 **************************************************************************/

	focus(stats) {
		if (stats) {
			this.element.style.borderColor = getComputedStyle(document.body).color;
			this.table.element.focus();
		} else {
			this.element.style.borderColor = getComputedStyle(document.body).backgroundColor;
		}
	}

	toggleSelect(index) {
		if (this.fileItems.length <= index) {
			return;
		}
		const fileItem = this.fileItems[index];
		const select = fileItem.getSelect();
		this.fileList.setSelect(fileItem, !select);
		this.table.updateAtIndex(index);
		fileItem.getSize().then(() => {
			this.updateStatus();
		})
	}

	openItem(index) {
		if (this.fileItems.length <= index) {
			return null;
		}
		const fileItem = this.fileItems[index];
		const dirent = fileItem.getDirent();
		if (dirent.isDirectory() && dirent.name != '.') {
			this.cwd = fileItem.getUri();
			this.update(true);
		} else {
			atom.open({ pathsToOpen: fileItem.getUri() });
		}
		return fileItem;
	}

	moveUp() {
		const prevActive = this.table.active;
		if (prevActive <= 0) {
			return;
		}
		const active = prevActive - 1;
		this.fileList.setActive(active);
		this.table.active = active;
		this.table.updateAtIndex(prevActive);
		this.table.updateAtIndex(active);
	}

	moveDown() {
		console.log(this.table.active);
		const prevActive = this.table.active;
		if (prevActive >= this.fileItems.length) {
			return;
		}
		const active = prevActive + 1;
		this.fileList.setActive(active);
		this.table.active = active;
		this.table.updateAtIndex(prevActive);
		this.table.updateAtIndex(active);
		console.log(this.table.active);
	}

	select() {
		const active = this.table.active;
		this.toggleSelect(active);
	}

	open() {
		const active = this.table.active;
		this.openItem(active);
	}

	headLeftClick(event, index) {
		console.log(event, index);
		this.updateFocus(this);
	}

	headRightClick(event, index) {
		console.log(event, index);
		this.updateFocus(this);
	}

	bodyLeftClick(event, index) {
		if (event.target.className.includes('icon')) {
			this.toggleSelect(index);
		} else {
			const prevActive = this.table.active;
			this.fileList.setActive(index);
			this.table.active = index;
			this.table.updateAtIndex(prevActive);
			this.table.updateAtIndex(index);
		}
		this.updateFocus(this);
	}

	bodyRightClick(event, index) {
		console.log(event, index);
		this.toggleSelect(index);
		this.updateFocus(this);
	}

	bodyDoubleClick(event, index) {
		console.log(event, index);
		this.openItem(index);
		this.updateFocus(this);
	}

	sortFileItems(fileItems, type, dirFirst) {
		console.log(type);
		fileItems.sort((a, b) => {
			if (dirFirst) {
				if (a.dirent.isDirectory() && !b.dirent.isDirectory()) {
					return -1;
				} else if (!a.dirent.isDirectory() && b.dirent.isDirectory()) {
					return 1;
				}
			}
			if (a.dirent.name <= b.dirent.name) {
				return -1;
			}
			return 1;
		});
	}

	/***************************************************************************
	 * Update
	 **************************************************************************/

	/**
	 * @param {Number} size - Size in bytes
	 * @returns {String} - Size with unit from B to TB
	 */
	getSizeWithUnit(size) {
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let unitIndex = 0;
		while (size > 1024 && unitIndex < units.length - 1) {
			size = size / 1024;
			unitIndex++;
		}
		return size.toFixed(2) + ' ' + units[unitIndex];
	}

	updateDisk() {
		disk(this.fileList.getDirectory(), (err, info) => {
			if (err) {
				return console.log(err);
			}
			this.prog.max = info.total;
			this.prog.value = info.used;
			this.usage.innerText = `${this.getSizeWithUnit(info.used)} / ${this.getSizeWithUnit(info.total)}`;
		});
	}

	updatePath() {
		this.path.innerText = this.fileList.getDirectory() + ':';
	}

	updateStatus() {
		this.fileList.wait().then(() => {
			const status = `selected: ${this.getSizeWithUnit(this.fileList.selectSize)} ` +
				`of ${this.getSizeWithUnit(this.fileList.totalSize)}\n` +
				`files: ${this.fileList.selectFiles} of ${this.fileList.totalFiles}\n` +
				`directories: ${this.fileList.selectDirectories} of ` +
				`${this.fileList.totalDirectories}`;
			this.status.innerText = status;
		});
	}

	headRenderer(row) {
		const tr = document.createElement('tr');
		let i = 0;
		for (const item of row) {
			const th = document.createElement('th');
			th.style.whiteSpace = 'nowrap';
			th.style.textOverflow = 'ellipsis';
			th.style.overflow = 'hidden';
			th.style.paddingLeft = '4px';
			th.style.paddingRight = '4px';
			th.classList.add(`atom-cmd-col${i}`);
			i++;
			th.innerText = item;
			tr.appendChild(th);
		}
		return tr;
	}

	rowName(row) {
		const dirent = row.getDirent();
		const ext = path.extname(dirent.name);
		const base = path.basename(dirent.name, ext);
		const td = document.createElement('td');
		td.style.whiteSpace = 'nowrap';
		td.style.textOverflow = 'ellipsis';
		td.style.overflow = 'hidden';
		td.style.paddingLeft = '4px';
		td.style.paddingRight = '4px';
		td.classList.add(`atom-cmd-col0`);

		const icon = document.createElement('span');
		if (this.addIconToElement) {
			const disposable = this.addIconToElement(icon, dirent.name, { isDirectory: dirent.isDirectory() });
			this.icons.add(disposable);
		} else {
			if (dirent.isDirectory()) {
				icon.innerHTML = "<i class='icon icon-file-directory'>";
			} else {
				icon.innerHTML = "<i class='icon icon-file-text'>";
			}
		}
		icon.style.paddingRight = '8px';
		td.appendChild(icon);

		const name = document.createElement('span');
		if (dirent.isDirectory()) {
			name.innerText = '[' + base + ']';
		} else {
			name.innerText = base;
		}
		td.appendChild(name);

		return td;
	}

	rowExt(row) {
		const dirent = row.getDirent();
		const ext = path.extname(dirent.name);
		const td = document.createElement('td');
		td.style.whiteSpace = 'nowrap';
		td.style.textOverflow = 'ellipsis';
		td.style.overflow = 'hidden';
		td.style.paddingLeft = '4px';
		td.style.paddingRight = '4px';
		td.classList.add(`atom-cmd-col1`);
		td.innerText = ext.substring(1);
		return td;
	}

	rowSize(row) {
		const dirent = row.getDirent();
		const select = row.getSelect();
		const td = document.createElement('td');
		td.style.whiteSpace = 'nowrap';
		td.style.textOverflow = 'ellipsis';
		td.style.overflow = 'hidden';
		td.style.textAlign = 'right';
		td.style.paddingLeft = '4px';
		td.style.paddingRight = '4px';
		td.classList.add(`atom-cmd-col2`);
		if (dirent.isDirectory() && !select) {
			td.innerText = '<DIR>';
		} else {
			row.getSize().then((size) => {
				td.innerText = this.getSizeWithUnit(size);
			});
		}
		return td;
	}

	rowDate(row) {
		const td = document.createElement('td');
		td.style.whiteSpace = 'nowrap';
		td.style.textOverflow = 'ellipsis';
		td.style.overflow = 'hidden';
		td.style.paddingLeft = '4px';
		td.style.paddingRight = '4px';
		td.classList.add(`atom-cmd-col3`);
		row.getStats().then((stats) => {
			const mtime = stats.mtime;
			const year = mtime.getFullYear().toString().padStart(4, 0);
			const month = mtime.getMonth().toString().padStart(2, 0);
			const date = mtime.getDate().toString().padStart(2, 0);
			const hour = mtime.getHours().toString().padStart(2, 0);
			const minute = mtime.getMinutes().toString().padStart(2, 0);
			td.innerText = `${year}-${month}-${date} ${hour}:${minute}`;
		});
		return td;
	}

	rowAttr(row) {
		const td = document.createElement('td');
		td.style.whiteSpace = 'nowrap';
		td.style.textOverflow = 'ellipsis';
		td.style.overflow = 'hidden';
		td.style.paddingLeft = '4px';
		td.style.paddingRight = '4px';
		td.classList.add(`atom-cmd-col4`);
		row.getStats().then((stats) => {
			let attr = '';
			switch (stats.mode & fs.constants.S_IFMT) {
				case fs.constants.S_IFREG:
					attr = attr.concat('-');
					break;
				case fs.constants.S_IFDIR:
					attr = attr.concat('d');
					break;
				case fs.constants.S_IFCHR:
					attr = attr.concat('c');
					break;
				case fs.constants.S_IFBLK:
					attr = attr.concat('b');
					break;
				case fs.constants.S_IFFIFO:
					attr = attr.concat('f');
					break;
				case fs.constants.S_IFLNK:
					attr = attr.concat('l');
					break;
				case fs.constants.S_IFSOCK:
					attr = attr.concat('s');
					break;
				default:
					attr = attr.concat('e');
					break;
			}
			attr = attr.concat((stats.mode & 0o400 /*fs.constants.S_IRUSR*/) ? 'r' : '-');
			attr = attr.concat((stats.mode & 0o200 /*fs.constants.S_IWUSR*/) ? 'w' : '-');
			attr = attr.concat((stats.mode & 0o100 /*fs.constants.S_IXUSR*/) ? 'x' : '-');
			attr = attr.concat((stats.mode & 0o040 /*fs.constants.S_IRGRP*/) ? 'r' : '-');
			attr = attr.concat((stats.mode & 0o020 /*fs.constants.S_IWGRP*/) ? 'w' : '-');
			attr = attr.concat((stats.mode & 0o010 /*fs.constants.S_IXGRP*/) ? 'x' : '-');
			attr = attr.concat((stats.mode & 0o004 /*fs.constants.S_IROTH*/) ? 'r' : '-');
			attr = attr.concat((stats.mode & 0o002 /*fs.constants.S_IWOTH*/) ? 'w' : '-');
			attr = attr.concat((stats.mode & 0o001 /*fs.constants.S_IXOTH*/) ? 'x' : '-');
			td.innerText = attr;
		});
		return td;
	}

	bodyRenderer(row, active) {
		const tr = document.createElement('tr');
		tr.style.overflow = 'hidden';
		tr.style.borderStyle = 'solid';
		tr.style.borderWidth = '1px';
		if (active) {
			tr.style.borderColor = getComputedStyle(document.body).color;
		} else {
			tr.style.borderColor = getComputedStyle(document.body).backgroundColor;
		}
		if (row.getSelect()) {
			tr.style.color = 'red';
		} else {
			tr.style.color = getComputedStyle(document.body).color;
		}
		const rowRenderer = [
			this.rowName.bind(this),
			this.rowExt.bind(this),
			this.rowSize.bind(this),
			this.rowDate.bind(this),
			this.rowAttr.bind(this)
		];
		for (const renderer of rowRenderer) {
			const td = renderer(row);
			tr.appendChild(td);
		}
		return tr;
	}

	async update(force = false) {
		// File list
		if (force || !this.fileList) {
			this.fileList = this.fileListCache.getFileList(this.cwd);
			this.fileList.update();
		}

		// UI
		this.updateDisk();
		this.updatePath();
		this.fileList.getFileItems().then((fileItems) => {
			this.fileItems = fileItems;
			this.table.update({
				heads: this.heads,
				bodys: this.fileItems,
				active: this.fileList.getActive()
			});
			this.updateStatus();
		})
	}

	/**
	 * @param {Number} width
	 * @param {Number} height
	 * @returns {Boolean} - true for re-resize or false for don't need to resize
	 */
	resize(width, height) {
		const disk = this.disk.getClientRects();
		const path = this.path.getClientRects();
		const status = this.status.getClientRects();
		if (width <= 0 || height <= 0 ||
			disk.length == 0 || path.length == 0 || status.length == 0) {
			return true;
		}
		const tableWidth = width;
		const tableHeight = height - disk[0].height - path[0].height - status[0].height;
		return this.table.resize(tableWidth, tableHeight);
	}
}

module.exports = {
	FileListView
}
