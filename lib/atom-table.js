'use babel';
/** @babel */
/** @jsx etch.dom */

const { CompositeDisposable } = require('atom');
const etch = require('etch');

class AtomTableHead {
	/**
	 * @property {CompositeDisposable} disposables
	 * @property {Function} renderer
	 * @property {Function} leftClick
	 * @property {Function} rightClick
	 * @property {Element} element
	 */

	/**
	 * @constructor
	 * @param {Object[]} props.items
	 * @param {Function} props.renderer
	 * @param {Function} props.leftClick
	 * @param {Function} props.rightClick
	 * @returns {AtomTableHead}
	 */
	constructor(props) {
		this.disposables = new CompositeDisposable();
		this.renderer = props.renderer;
		this.leftClickFunc = props.leftClick;
		this.rightClickFunc = props.rightClick;
		this.update(props);
	}

	destroy() {
		this.disposables.dispose();
		this.element.remove();
	}

	update(props) {
		this.element = document.createElement('thead');
		this.element.style.display = 'block';
		this.element.style.position = 'sticky';
		const headRow = this.renderer(props.items);
		this.element.appendChild(headRow);
	}
}

class AtomTableRow {
	/**
	 * @property {CompositeDisposable} disposables
	 * @property {Function} renderer
	 * @property {Function} leftClick
	 * @property {Function} rightClick
	 * @property {Function} doubleClick
	 * @property {Element} element
	 * @property {Number} index
	 */

	/**
	 * @constructor
	 * @param {Object} props.item
	 * @param {Number} props.index
	 * @param {Boolean} props.active
	 * @param {Function} props.renderer
	 * @param {Function} props.leftClick
	 * @param {Function} props.rightClick
	 * @param {Function} props.doubleClick
	 * @returns {AtomTableRow}
	 */
	constructor(props) {
		this.disposables = new CompositeDisposable();
		this.renderer = props.renderer;
		this.leftClickFunc = props.leftClick;
		this.rightClickFunc = props.rightClick;
		this.doubleClickFunc = props.doubleClick;
		this.update(props);
	}

	destroy() {
		this.disposables.dispose();
		this.element.removeEventListener('click', this.leftClick.bind(this));
		this.element.removeEventListener('contextmenu', this.rightClick.bind(this));
		this.element.removeEventListener('dblclick', this.doubleClick.bind(this));
		this.element.remove();
	}

	update(props) {
		const element = this.renderer(props.item, props.active);
		if (this.element) {
			this.element.removeEventListener('click', this.leftClick.bind(this));
			this.element.removeEventListener('contextmenu', this.rightClick.bind(this));
			this.element.removeEventListener('dblclick', this.doubleClick.bind(this));
			this.element.parentNode.replaceChild(element, this.element);
		}
		this.element = element;
		this.index = props.index;
		this.element.addEventListener('click', this.leftClick.bind(this));
		this.element.addEventListener('contextmenu', this.rightClick.bind(this));
		this.element.addEventListener('dblclick', this.doubleClick.bind(this));
	}

	leftClick(event) {
		this.leftClickFunc(event, this.index);
	}

	rightClick(event) {
		this.rightClickFunc(event, this.index);
	}

	doubleClick(event) {
		this.doubleClickFunc(event, this.index);
	}
}

module.exports = class AtomTable {
	/**
	 * @property {CompositeDisposable} disposables
	 * @property {Object[]} heads
	 * @property {Object[]} bodys
	 * @property {Number} active
	 * @property {Function} headRenderer
	 * @property {Function} headLeftClick
	 * @property {Function} headRightClick
	 * @property {Function} bodyRenderer
	 * @property {Function} bodyLeftClick
	 * @property {Function} bodyRightClick
	 * @property {Function} bodyDoubleClick
	 * @property {Number[]} widths
	 * @property {Object[]} tableItems
	 */

	/**
	 * @constructor
	 * @param {Object[]} props.heads
	 * @param {Object[]} props.bodys
	 * @param {Number} props.active
	 * @param {Function} props.headRenderer
	 * @param {Function} props.headLeftClick
	 * @param {Function} props.headRightClick
	 * @param {Function} props.bodyRenderer
	 * @param {Function} props.bodyLeftClick
	 * @param {Function} props.bodyRightClick
	 * @param {Function} props.bodyDoubleClick
	 * @returns {AtomTable}
	 */
	constructor(props) {
		this.disposables = new CompositeDisposable();
		this.heads = props.heads;
		this.bodys = props.bodys;
		this.active = props.active;
		this.headRenderer = props.headRenderer;
		this.headLeftClick = props.headLeftClick;
		this.headRightClick = props.headRightClick;
		this.bodyRenderer = props.bodyRenderer;
		this.bodyLeftClick = props.bodyLeftClick;
		this.bodyRightClick = props.bodyRightClick;
		this.bodyDoubleClick = props.bodyDoubleClick
		this.widths = atom.config.get('atom-cmd.widths').split(',').map(Number);
		etch.initialize(this);
	}

	async destroy() {
		this.disposables.dispose();
		if (this.visibilityObserver) {
			this.visibilityObserver.disconnect();
		}
		await etch.destroy(this);
	}

	render() {
		this.tableItems = [];
		if (this.bodys && this.bodys.length > 0) {
			this.tableItems = this.bodys.map((item, index) => {
				return etch.dom(AtomTableRow, {
					item: item,
					index: index,
					active: (this.active == index),
					renderer: this.bodyRenderer,
					leftClick: this.bodyLeftClick,
					rightClick: this.bodyRightClick,
					doubleClick: this.bodyDoubleClick
				});
			});
		}
		return etch.dom('table', { class: 'atom-cmd', style: { tableLayout: 'fixed', width: '100%' } },
			etch.dom(AtomTableHead, {
				items: this.heads,
				renderer: this.headRenderer,
				leftClick: this.headLeftClick,
				rightClick: this.headRightClick
			}),
			etch.dom('tbody', { style: { tableLayout: 'fixed', display: 'block', width: '100%', whiteSpace: 'nowrap', overflowY: 'auto', overflowX: 'hidden' } },
				...this.tableItems
			)
		);
	}

	/***************************************************************************
	 * Update
	 **************************************************************************/

	updateAtIndex(index) {
		if (this.tableItems.length <= index) {
			return;
		}
		const component = this.tableItems[index].component;
		component.update({
			item: this.bodys[index],
			index: index,
			active: (this.active == index)
		});
		component.element.focus();
	}

	async update(props) {
		this.heads = props.heads;
		this.bodys = props.bodys;
		this.active = props.active;
		return etch.update(this);
	}

	resize(width, height) {
		// width
		this.widths = atom.config.get('atom-cmd.widths').split(',').map(Number);
		let i, sum = 0;
		for (const width of this.widths) {
			sum += width;
		}
		for (i = 0; i < this.widths.length; i++) {
			if (this.widths[i] == 0) {
				this.widths[i] = width - sum;
				break;
			}
		}
		const style = document.createElement('style');
		for (i = 0; i < this.widths.length; i++) {
			style.innerHTML += `.atom-cmd-col${i} {
				white-space: nowrap;
				text-overflow: ellipsis;
				overflow: hidden;
				width: ${this.widths[i]}px;
				min-width: ${this.widths[i]}px;
				max-width: ${this.widths[i]}px;
			}`;
		}
		if (this.style) {
			this.element.replaceChild(style, this.style);
		} else {
			this.element.appendChild(style);
		}
		this.style = style;

		// height
		height = Math.round(height);
		const tbody = this.element.getElementsByTagName('tbody')[0];
		if (tbody.style.height === height + 'px') {
			return false;
		}
		tbody.style.height = height + 'px';
		return true;
	}
}
