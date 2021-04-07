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
	 * @property {Number} active
	 * @property {String} sortType
	 * @property {Boolean} ascending
	 * @property {FileListCache} fileListCache
	 * @property {FileList} fileList
	 * @property {FileItem[]} fileItems
	 *
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
	 * @param {Number} active
	 * @param {FileListCache} fileListCache
	 * @param {Function} addIconToElement
	 * @param {Function} updateFocus
	 * @returns {FileListView}
	 */
	constructor(cwd, active, sortType, ascending, fileListCache, addIconToElement, updateFocus) {
		this.disposables = new CompositeDisposable();
		this.cwd = cwd;
		this.active = active;
		this.sortType = sortType;
		this.ascending = ascending;
		this.fileListCache = fileListCache;

		this.addIconToElement = addIconToElement;
		this.updateFocus = updateFocus;

		// Element
		this.element = document.createElement('div');
		this.element.className = 'atom-cmd-inactive';
		this.element.style.flex = 1;
		this.element.style.display = 'flex';
		this.element.style.flexDirection = 'column';
		this.element.style.alignItems = 'stretch';
		this.element.style.height = '100%';

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
		this.element.addEventListener('focus', (event) => {
			this.updateFocus(this);
			event.stopPropagation();
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
		this.table.destroy();
	}

	getDirectory() {
		return this.cwd;
	}

	/***************************************************************************
	 * Action
	 **************************************************************************/

	focus(stats) {
		if (stats) {
			this.element.className = 'atom-cmd-active';
			this.table.element.focus();
		} else {
			this.element.className = 'atom-cmd-inactive';
		}
	}

	toggleSelect(index) {
		if (this.fileItems.length <= index) {
			return;
		}
		const fileItem = this.fileItems[index];
		const select = fileItem.getSelect();
		this.fileList.setSelect(fileItem, !select);
		this.table.updateAtIndex(index, true, true);
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

	openUri(uri) {
		this.cwd = uri;
		this.update(true);
	}

	moveUp() {
		const prevActive = this.table.getActive();
		if (prevActive <= 0) {
			return;
		}
		const active = prevActive - 1;
		this.fileList.setActive(active);
		this.table.setActive(active);
		this.table.updateAtIndex(prevActive, true, true);
		this.table.updateAtIndex(active, true, true);
	}

	moveDown() {
		const prevActive = this.table.getActive();
		if (prevActive >= this.fileItems.length - 1) {
			return;
		}
		const active = prevActive + 1;
		this.fileList.setActive(active);
		this.table.setActive(active);
		this.table.updateAtIndex(prevActive, true, true);
		this.table.updateAtIndex(active, true, true);
	}

	calculatePageCount() {
		const tbody = this.table.element.getElementsByTagName('tbody')[0];
		const tbodyHeight = tbody.getClientRects()[0].height;
		const tr = this.table.element.getElementsByTagName('tr')[0];
		const trHeight = tr.getClientRects()[0].height;
		const count = Math.floor(tbodyHeight / trHeight);
		return count;
	}

	pageUp() {
		const prevActive = this.table.getActive();
		if (prevActive <= 0) {
			return;
		}
		let active = prevActive - this.calculatePageCount();
		if (active < 0) {
			active = 0;
		}
		this.fileList.setActive(active);
		this.table.setActive(active);
		this.table.updateAtIndex(prevActive, true, true);
		this.table.updateAtIndex(active, true, true);
	}

	pageDown() {
		const prevActive = this.table.getActive();
		if (prevActive >= this.fileItems.length - 1) {
			return;
		}
		let active = prevActive + this.calculatePageCount();
		if (active >= this.fileItems.length) {
			active = this.fileItems.length - 1;
		}
		this.fileList.setActive(active);
		this.table.setActive(active);
		this.table.updateAtIndex(prevActive, true, true);
		this.table.updateAtIndex(active, true, true);
	}

	select() {
		const active = this.table.getActive();
		this.toggleSelect(active);
	}

	open() {
		const active = this.table.getActive();
		this.openItem(active);
	}

	headLeftClick(event) {
		for (const head of this.heads) {
			if (event.target.innerText.startsWith(head)) {
				this.sortType = head;
				this.ascending = !event.target.innerText.endsWith('\u2191');
				break;
			}
		}
		this.update();
		this.updateFocus(this);
	}

	headRightClick(event) {
		console.log(event.target.innerText);
		this.updateFocus(this);
	}

	bodyLeftClick(event, index) {
		if (event.target.className.includes('icon')) {
			this.toggleSelect(index);
		} else {
			const prevActive = this.table.getActive();
			this.fileList.setActive(index);
			this.table.setActive(index);
			this.table.updateAtIndex(prevActive, true, false);
			this.table.updateAtIndex(index, true, false);
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
		tr.classList.add('atom-table-head');
		let i = 0;
		for (const item of row) {
			const th = document.createElement('th');
			th.classList.add('atom-table-head-cell');
			th.classList.add(`atom-table-col${i}`);
			i++;
			if (item === this.sortType) {
				if (this.ascending) {
					th.innerText = item + '\u2191';
				} else {
					th.innerText = item + '\u2193';
				}
			} else {
				th.innerText = item;
			}
			tr.appendChild(th);
		}
		return [tr, []];
	}

	rowName(row) {
		const disposables = [];
		const dirent = row.getDirent();
		const ext = path.extname(dirent.name);
		const base = path.basename(dirent.name, ext);
		const td = document.createElement('td');
		td.classList.add('atom-table-body-cell');
		td.classList.add(`atom-table-col0`);

		const icon = document.createElement('span');
		if (this.addIconToElement) {
			const disposable = this.addIconToElement(icon, dirent.name, { isDirectory: dirent.isDirectory() });
			disposables.push(disposable);
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

		return [td, disposables];
	}

	rowExt(row) {
		const dirent = row.getDirent();
		const ext = path.extname(dirent.name);
		const td = document.createElement('td');
		td.classList.add('atom-table-body-cell');
		td.classList.add(`atom-table-col1`);
		td.innerText = ext.substring(1);
		return [td, []];
	}

	rowSize(row) {
		const dirent = row.getDirent();
		const select = row.getSelect();
		const td = document.createElement('td');
		td.classList.add('atom-table-body-cell');
		td.classList.add(`atom-table-col2`);
		td.style.textAlign = 'right';
		if (dirent.isDirectory() && !select) {
			td.innerText = '<DIR>';
		} else {
			row.getSize().then((size) => {
				td.innerText = this.getSizeWithUnit(size);
			});
		}
		return [td, []];
	}

	rowDate(row) {
		const td = document.createElement('td');
		td.classList.add('atom-table-body-cell');
		td.classList.add(`atom-table-col3`);
		row.getStats().then((stats) => {
			const mtime = stats.mtime;
			const year = mtime.getFullYear().toString().padStart(4, 0);
			const month = mtime.getMonth().toString().padStart(2, 0);
			const date = mtime.getDate().toString().padStart(2, 0);
			const hour = mtime.getHours().toString().padStart(2, 0);
			const minute = mtime.getMinutes().toString().padStart(2, 0);
			td.innerText = `${year}-${month}-${date} ${hour}:${minute}`;
		});
		return [td, []];
	}

	rowAttr(row) {
		const td = document.createElement('td');
		td.classList.add('atom-table-body-cell');
		td.classList.add(`atom-table-col4`);
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
		return [td, []];
	}

	bodyRenderer(row, active, visible) {
		let disposables = [];
		const tr = document.createElement('tr');
		tr.style.overflow = 'hidden';
		tr.style.borderStyle = 'solid';
		tr.style.borderWidth = '1px';
		let className = 'atom-table-body';
		if (active) {
			className += '-active';
		}
		if (row.getSelect()) {
			className += '-select';
		}
		tr.classList.add(className);
		if (!visible) {
			tr.innerText = 'item';
			return [tr, disposables];
		}
		const rowRenderer = [
			this.rowName.bind(this),
			this.rowExt.bind(this),
			this.rowSize.bind(this),
			this.rowDate.bind(this),
			this.rowAttr.bind(this)
		];
		for (const renderer of rowRenderer) {
			const [td, disposablesColumn] = renderer(row);
			tr.appendChild(td);
			disposables = disposables.concat(disposablesColumn);
		}
		return [tr, disposables];
	}

	async update(force = false) {
		// File list
		if (force || !this.fileList) {
			const fileList = this.fileListCache.getFileList(this.cwd);
			fileList.update();
			if (!this.fileList) {
				fileList.setActive(this.active);
			}
			this.fileList = fileList;
		}

		// UI
		this.updateDisk();
		this.updatePath();
		this.fileList.getFileItems().then((fileItems) => {
			this.fileItems = fileItems;
			this.fileList.sort(true, this.sortType, this.ascending).then(() => {
				this.table.update({
					heads: this.heads,
					bodys: this.fileItems,
					active: this.fileList.getActive()
				});
				this.updateStatus();
			});
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
