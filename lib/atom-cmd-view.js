'use babel';

const path = require('path');
const { CompositeDisposable } = require('atom');
const { FileListCache } = require('./file-list');
const { FileListView } = require('./file-list-view');

module.exports = class AtomCmdView {
	/**
	 * @property {CompositeDisposable} disposables
	 * @property {FileListCache} fileListCache
	 * @property {Function} addIconToElement
	 *
	 * @property {Element} element
	 * @property {Element} columns
	 *
	 * @property {...} toolbarButton
	 * @property {Element} toolbar
	 *
	 * @property {Element} main
	 * @property {FileListView} leftView
	 * @property {FileListView} rightView
	 *
	 * @property {...} functionButton
	 * @property {Element} function
	 *
	 * @property {FileListView} focus
	 * @property {ResizeObserver} resizeObserver
	 * @property {Disposable} disposableActiveItem
	 */

	/**
	 * @constructor
	 * @param {FileListCache} fileListCache
	 * @param {Function} addIconToElement
	 * @returns {AtomCmdView}
	 */
	constructor(fileListCache, addIconToElement) {
		this.disposables = new CompositeDisposable();
		this.fileListCache = fileListCache;
		this.addIconToElement = addIconToElement;

		// Top element
		this.element = document.createElement('div');
		this.element.classList.add('pane-item');
		this.element.style.fontFamily = atom.config.get('editor.fontFamily');
		this.element.style.fontSize = atom.config.get('editor.fontSize') + 'px';
		this.columns = document.createElement('div');
		this.columns.style.display = 'flex';
		this.columns.style.flexDirection = 'column';
		this.columns.style.height = '100%';
		this.element.appendChild(this.columns);

		// Toolbar
		const toolbarButton = [
			{ icon: 'alert', name: 'test1', leftClick: null, rightClick: null },
			{ icon: 'arrow-down', name: 'test2', leftClick: null, rightClick: null }
		];
		this.toolbar = this.createButtonbar(toolbarButton, false);
		this.columns.appendChild(this.toolbar);

		// List
		this.main = document.createElement('div');
		this.main.style.flex = 1;
		this.main.style.display = 'flex';
		this.main.style.flexDirection = 'row';
		this.main.style.alignItems = 'stretch';
		this.columns.appendChild(this.main);

		// List - left
		let leftPath = atom.config.get('atom-cmd.leftPath');
		if (leftPath === undefined) {
			leftPath = this.getCurrentDirectory();
		}
		let leftActive = atom.config.get('atom-cmd.leftActive');
		if (leftActive === undefined) {
			leftActive = 0;
		}
		let leftSortType = atom.config.get('atom-cmd.leftSortType');
		if (leftSortType === undefined) {
			leftSortType = 'name';
		}
		let leftAscending = atom.config.get('atom-cmd.leftAscending');
		if (leftAscending === undefined) {
			leftAscending = true;
		}
		this.leftView = new FileListView(leftPath, leftActive, leftSortType, leftAscending,
			this.fileListCache, this.addIconToElement, this.updateFocus.bind(this));
		this.main.appendChild(this.leftView.element);

		// List - right
		let rightPath = atom.config.get('atom-cmd.rightPath');
		if (rightPath === undefined) {
			rightPath = this.getCurrentDirectory();
		}
		let rightActive = atom.config.get('atom-cmd.rightActive');
		if (rightActive === undefined) {
			rightActive = 0;
		}
		let rightSortType = atom.config.get('atom-cmd.rightSortType');
		if (rightSortType === undefined) {
			rightSortType = 'name';
		}
		let rightAscending = atom.config.get('atom-cmd.rightAscending');
		if (rightAscending === undefined) {
			rightAscending = true;
		}
		this.rightView = new FileListView(rightPath, rightActive, rightSortType, rightAscending,
			this.fileListCache, this.addIconToElement, this.updateFocus.bind(this));
		this.main.appendChild(this.rightView.element);

		// Function
		const functionButton = [
			{ icon: null, name: 'View', leftClick: this.viewLeftClick.bind(this), rightClick: null },
			{ icon: null, name: 'Edit', leftClick: null, rightClick: null },
			{ icon: null, name: 'Copy', leftClick: null, rightClick: null },
			{ icon: null, name: 'Move', leftClick: null, rightClick: null },
			{ icon: null, name: 'Directory', leftClick: null, rightClick: null },
			{ icon: null, name: 'Delete', leftClick: null, rightClick: null },
			{ icon: null, name: 'Terminal', leftClick: null, rightClick: null },
			{ icon: null, name: 'Exit', leftClick: null, rightClick: null }
		];
		this.function = this.createButtonbar(functionButton, true);
		this.function.style.marginTop = 'auto';
		this.columns.appendChild(this.function);

		// Focus
		const active = atom.config.get('atom-cmd.active');
		this.updateFocus((active && active == 1) ? this.rightView : this.leftView);

		// Observe size of this element
		this.resizeObserver = new ResizeObserver(this.resize.bind(this));
		this.resizeObserver.observe(this.element);

		// Observe active item
		this.disposableActiveItem = atom.workspace.observeActivePaneItem((item) => {
			if (item instanceof AtomCmdView) {
				item.element.parentElement.parentElement.classList.add('atom-cmd');
				item.registerCommands(item.element.parentElement.parentElement);
				this.disposableActiveItem.dispose();
				this.disposableActiveItem = null;
				item.element.parentElement.parentElement.focus();
			}
		});
	}

	/**
	 * @param {String} button - Button attribute list.
	 * @param {Boolean} flex - Flex attribute for buttons.
	 * @returns {Element} - Button bar.
	 */
	createButtonbar(buttons, flex) {
		const bar = document.createElement('div');
		bar.style.flex = 0;
		bar.style.display = 'flex';
		bar.style.flexDirection = 'row';
		for (const button of buttons) {
			const btn = document.createElement('button');
			btn.classList.add('btn');
			if (flex) {
				btn.style.flex = 1;
			}
			if (button.icon) {
				const span = document.createElement('span');
				span.classList.add('icon');
				span.classList.add('icon-' + button.icon);
				btn.appendChild(span);
			}
			const text = document.createElement('span');
			text.innerText = button.name;
			btn.appendChild(text);
			btn.addEventListener('click', button.leftClick);
			btn.addEventListener('contextmenu', button.rightClick);
			btn.addEventListener('focus', (event) => {
				event.target.parentElement.parentElement.parentElement.parentElement.parentElement.focus();
			});
			bar.appendChild(btn);
		}
		return bar;
	}

	/**
	 * @param {Element} element
	 * @returns {void}
	 */
	registerCommands(element) {
		// Register commands
		this.disposables.add(atom.commands.add(element, {
			'atom-cmd:toggle-focus': () => this.updateFocus((this.getFocus() === this.leftView) ? this.rightView : this.leftView),
			'core:move-up': () => this.getFocus().moveUp(),
			'core:move-down': () => this.getFocus().moveDown(),
			'core:page-up': () => this.getFocus().pageUp(),
			'core:page-down': () => this.getFocus().pageDown(),
			'atom-cmd:open': () => this.getFocus().open(),
			"core:backspace": () => {
				const uri = path.join(this.getFocus().getDirectory(), '..');
				this.getFocus().openUri(path.normalize(uri));
			},
			"core:cancel": () => {
				const pane = atom.workspace.getActivePane();
				const item = pane.getActiveItem();
				if (item === this) {
					pane.destroyItem(item);
				}
			},
			'atom-cmd:update': () => this.update(),
			'atom-cmd:toggle-mark': () => this.getFocus().select(),
			'atom-cmd:toggle-mark-next': () => {
				this.getFocus().select();
				this.getFocus().moveDown();
			}
		}));
	}

	/**
	 * @returns {Promise<void>}
	 */
	async destroy() {
		if (this.disposableActiveItem) {
			this.disposableActiveItem.dispose();
		}
		this.resizeObserver.disconnect();
		atom.config.set('atom-cmd.leftPath', this.leftView.cwd);
		if (this.leftView.fileList) {
			atom.config.set('atom-cmd.leftActive', this.leftView.fileList.getActive());
		}
		atom.config.set('atom-cmd.leftSortType', this.leftView.sortType);
		atom.config.set('atom-cmd.leftAscending', this.leftView.ascending);
		atom.config.set('atom-cmd.rightPath', this.rightView.cwd);
		if (this.rightView.fileList) {
			atom.config.set('atom-cmd.rightActive', this.rightView.fileList.getActive());
		}
		atom.config.set('atom-cmd.rightSortType', this.rightView.sortType);
		atom.config.set('atom-cmd.rightAscending', this.rightView.ascending);
		atom.config.set('atom-cmd.active', (this.getFocus() === this.leftView) ? 0 : 1);
		this.leftView.destroy();
		this.rightView.destroy();
		this.element.remove();
		this.disposables.dispose();
		this.addIconToElement = null;
	}

	/**
	 * Get a current directory.
	 * @returns {String} - A current directory.
	 */
	getCurrentDirectory() {
		const projects = atom.project.getPaths();
		if (projects.length > 0) {
			return projects[0];
		}
		const editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			const file = editor.getPath();
			return path.dirname(file);
		}
		if (process.env.home) {
			return process.env.home;
		}
		return '';
	}

	/***************************************************************************
	 * Basic action
	 **************************************************************************/

	getFocus() {
		return this.focus;
	}

	getBlur() {
		return (this.focus === this.leftView) ? this.rightView : this.leftView;
	}

	updateFocus(fileListView) {
		this.focus = fileListView;
		this.leftView.focus(this.focus === this.leftView);
		this.rightView.focus(this.focus === this.rightView);
	}

	/***************************************************************************
	 * Button action
	 **************************************************************************/

	viewLeftClick(event) {
		console.log(event);
		if (!this.promiseTest) {
			this.promiseTest = new Promise((resolve/*, reject*/) => {
				setTimeout(() => {
					console.log('resolved');
					resolve();
				}, 1000);
			});
		} else {
			this.promiseTest.then(() => {
				console.log('then1');
			});
			console.log(this.promiseTest);
		}
	}

	/***************************************************************************
	 * Update
	 **************************************************************************/

	async update() {
		this.leftView.update(true, false, false);
		this.rightView.update(true, false, false);
	}

	/**
	 * @returns {void}
	 */
	resize() {
		const total = this.element.getClientRects();
		const toolbar = this.toolbar.getClientRects();
		const main = this.main.getClientRects();
		const func = this.function.getClientRects();
		if (total.length == 0 || toolbar == 0 ||
			main.length == 0 || func.length == 0) {
			setTimeout(this.resize.bind(this), 1000);
			return;
		}
		const width = total[0].width / 2;
		const height = total[0].height - toolbar[0].height - func[0].height * 2;
		if (this.leftView.resize(width, height) ||
			this.rightView.resize(width, height)) {
			setTimeout(this.resize.bind(this), 1000);
		}
	}

	/***************************************************************************
	 * Methods for an opener
	 **************************************************************************/

	getTitle() {
		return path.basename(this.getFocus().getDirectory());
	}

	getDefaultLocation() {
		return 'center';
	}

	getAllowedLocations() {
		return ['center', 'left', 'right', 'bottom'];
	}

	getURI() {
		return this.getFocus().getDirectory();
	}

	getPath() {
		return this.getFocus().getDirectory();
	}

	getElement() {
		return this.element;
	}
}
