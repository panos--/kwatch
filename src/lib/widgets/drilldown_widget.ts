import * as blessed from "blessed";
import { AppDefaults } from "../app_defaults";

interface DrilldownOptions extends blessed.Widgets.BoxOptions {
    parent: blessed.Widgets.Node;
}

export class DrilldownWidget {
    private parent: blessed.Widgets.Node;
    private screen: blessed.Widgets.Screen;
    private box: blessed.Widgets.BoxElement;
    private input: blessed.Widgets.TextboxElement;
    private values: string[];
    private list: blessed.Widgets.ListElement;

    private onSelectCallback: (value: string, index: number) => void;
    private onCloseCallback: () => void;

    private search = "";
    private filteredValues: string[];
    private selectedIndex: number;
    private selectedItem: string;

    public constructor(values: string[], options: DrilldownOptions) {
        this.parent = options.parent;
        this.screen = options.parent.screen;
        this.values = values;
        this.filteredValues = values;
        this.init();
        this.reset();
    }

    public init() {
        this.box = blessed.box({
            parent: this.parent,
            top: "center",
            left: "center",
            height: 30,
            width: 50,
            border: "line",
            padding: {
                top: 1,
            }
        });
        this.box.style.border.bg = AppDefaults.COLOR_BORDER_BG_FOCUS;
        this.box.setLabel("Choose Namespace");
        this.input = blessed.textbox({
            parent: this.box,
            top: 0,
            left: 0,
            height: 1,
            width: "100%-2",
        });
        this.input.style.bg = AppDefaults.COLOR_INPUT_BG;
        this.input.style.fg = AppDefaults.COLOR_INPUT_FG;
        this.input.style.bold = true;
        this.input.on("keypress", this.inputKeypress.bind(this));
        this.input.on("submit", () => {
            this.select();
        });

        this.list = blessed.list({
            parent: this.box,
            top: 2,
            left: 0,
            height: this.box.height - 5,
            width: "100%-2",
            keys: true,
            mouse: true,
            style: {
                item: {
                    hover: {
                        bg: "blue",
                        fg: "white",
                    }
                },
                selected: {
                    bg: "blue",
                    fg: "white",
                    bold: true
                }
            }
        });
        this.list.on("select item", (item, index) => {
            this.selectedItem = this.filteredValues[index];
            this.selectedIndex = index;
        });
        this.list.on("select", () => {
            this.select();
        });
        this.list.key(["tab", "S-tab"], () => {
            this.focus();
        });
        for (let value of this.values) {
            this.list.addItem(value);
        }
    }

    private select() {
        let value = this.selectedItem;
        this.close();
        if (this.onSelectCallback) {
            this.onSelectCallback.call(null, value, this.values.indexOf(value));
        }
    }

    public onSelect(callback: (value: string, index: number) => void) {
        this.onSelectCallback = callback;
    }

    public onClose(callback: () => void) {
        this.onCloseCallback = callback;
    }

    private reset() {
        this.search = "";
        this.filteredValues = this.values;
        this.selectedIndex = 0;
        this.selectedItem = this.filteredValues[0];
        this.input.setValue("");
    }

    private close() {
        this.box.hide();
        this.reset();
        if (this.onCloseCallback) {
            this.onCloseCallback.call(null);
        }
    }

    public destroy() {
        this.input.destroy();
        this.list.destroy();
        this.box.destroy();
    }

    private inputKeypress(ch: string, key: any) {
        if (key.name == "escape") {
            this.close();
            this.screen.render();
            return;
        }

        if (key.name == "enter") {
            return;
        }

        if (key.name == "down") {
            this.list.down(1);
            this.screen.render();
            return;
        }
        if (key.name == "up") {
            this.list.up(1);
            this.screen.render();
            return;
        }

        // NOTE: Taken from blessed (textarea.js)
        if (key.name === "backspace") {
            if (this.search.length) {
                if (this.screen.fullUnicode) {
                    // NOTE: Would require unicode.js from blessed.js
                    // if (unicode.isSurrogate(this.search, this.search.length - 2)) {
                    //     // || unicode.isCombining(this.search, this.search.length - 1)) {
                    //     this.search = this.search.slice(0, -2);
                    // } else {
                    this.search = this.search.slice(0, -1);
                    // }
                } else {
                    this.search = this.search.slice(0, -1);
                }
            }
        } else if (ch) {
            if (!/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
                this.search += ch;
            }
        }

        let prevSelectedItem = this.selectedItem;
        this.list.clearItems();
        this.filteredValues = this.values.filter(value => { return value.includes(this.search); });
        for (let value of this.filteredValues) {
            this.list.addItem(value);
        };
        this.selectedIndex = Math.max(0, this.filteredValues.indexOf(prevSelectedItem));
        this.selectedItem = this.filteredValues[this.selectedIndex];
        this.list.select(this.selectedIndex);
    }

    public focus() {
        this.box.show();
        this.screen.render();
        this.input.readInput(() => {});
    }
}
