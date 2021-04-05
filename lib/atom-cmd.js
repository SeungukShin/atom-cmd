'use babel';

const { CompositeDisposable } = require('atom');
const { FileListCache } = require('./file-list');
const AtomCmdView = require('./atom-cmd-view');

class AtomCmd {
	/**
	 * @property {CompositeDisposable} subscriptions
	 * @property {StatusBarView} statusBar
	 * @property {Function} addIconToElement
	 */

	/**
	 * @returns {void}
	 */
	activate() {
		this.subscriptions = new CompositeDisposable();

		// Auto openers
		this.subscriptions.add(atom.workspace.addOpener((uri) => {
			switch (uri) {
				case 'atom://atom-cmd/main':
					const fileListCache = new FileListCache(5);
					const atomCmdView = new AtomCmdView(fileListCache,
						this.addIconToElement);
					atomCmdView.update();
					return atomCmdView;
				default:
					return null;
			}
		}));

		// Register commands
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			"atom-cmd:toggle": () => this.toggle()
		}));

		console.log('"atom-cmd" is now active!');
	}

	/**
	 * @returns {void}
	 */
	deactivate() {
		this.subscriptions.dispose();

		console.log('"atom-cmd" is now inactive!');
	}

	/**
	 * @returns {void}
	 */
	toggle() {
		atom.workspace.toggle('atom://atom-cmd/main');
	}

	/**
	 * @param {StatusBarView} statusBar
	 * @returns {void}
	 */
	consumeStatusBar(statusBar) {
		this.statusbar = statusBar;
	}

	/**
	 * @param {Function} func
	 * @returns {void}
	 */
	consumeElementIcons(func) {
		this.addIconToElement = func;
	}
}

const atomCmd = new AtomCmd();
module.exports = atomCmd;
