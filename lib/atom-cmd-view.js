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
		this.leftView = new FileListView(leftPath, leftActive, this.fileListCache,
			this.addIconToElement, this.updateFocus.bind(this));
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
		this.rightView = new FileListView(rightPath, rightActive, this.fileListCache,
			this.addIconToElement, this.updateFocus.bind(this));
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
		let active = atom.config.get('atom-cmd.active');
		if (active && active == 1) {
			this.focus = this.rightView;
		} else {
			this.focus = this.leftView;
		}
		this.updateFocus(this.focus);

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
			"core:cancel": () => {
				const pane = atom.workspace.getActivePane();
				const item = pane.getActiveItem();
				if (item === this) {
					pane.destroyItem(item);
				}
			},
			'atom-cmd:update': () => this.update(),
			'atom-cmd:toggle-focus': () => {
				if (this.focus === this.leftView) {
					this.focus = this.rightView;
				} else {
					this.focus = this.leftView;
				}
				this.leftView.focus(this.focus == this.leftView);
				this.rightView.focus(this.focus == this.rightView);
			},
			'core:move-up': () => this.focus.moveUp(),
			'core:move-down': () => this.focus.moveDown(),
			'atom-cmd:open': () => this.focus.open(),
			'atom-cmd:toggle-mark': () => this.focus.select(),
			'atom-cmd:toggle-mark-next': () => {
				this.focus.select();
				this.focus.moveDown();
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
		atom.config.set('atom-cmd.rightPath', this.rightView.cwd);
		if (this.rightView.fileList) {
			atom.config.set('atom-cmd.rightActive', this.rightView.fileList.getActive());
		}
		let active = 0;
		if (this.focus === this.rightView) {
			active = 1;
		}
		atom.config.set('atom-cmd.active', active);
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
		this.leftView.update();
		this.rightView.update();
	}

	updateFocus(fileListView) {
		this.focus = fileListView;
		this.leftView.focus(this.focus == this.leftView);
		this.rightView.focus(this.focus == this.rightView);
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
		return path.basename(this.focus.cwd);
	}

	getDefaultLocation() {
		return 'center';
	}

	getAllowedLocations() {
		return ['center', 'left', 'right', 'bottom'];
	}

	getURI() {
		return this.focus.cwd;
	}

	getPath() {
		return this.focus.cwd;
	}

	getElement() {
		return this.element;
	}
}
