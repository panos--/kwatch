import * as blessed from "blessed";
import _ from "lodash";
import { AppContext } from "../app_context";

interface DrilldownOptions extends blessed.Widgets.BoxOptions {
    parent: blessed.Widgets.Node;
}

export class DrilldownWidget {
    private ctx: AppContext;
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

    public constructor(ctx: AppContext, values: string[], options: DrilldownOptions) {
        this.ctx = ctx;
        this.screen = options.parent.screen;
        this.values = values;
        this.filteredValues = values;
        this.init(options);
        this.reset();
    }

    public init(options: DrilldownOptions) {
        this.box = blessed.box(_.merge({
            top: "center",
            left: "center",
            // height: 30,
            height: 15,
            width: 50,
            border: "line",
            padding: {
                top: 1,
            }
        }, options));
        this.box.style.border.bg = this.ctx.colorScheme.COLOR_BORDER_BG;

        this.input = blessed.textbox({
            parent: this.box,
            top: 0,
            left: 0,
            height: 1,
            width: "100%-2",
        });
        this.input.style.bg = this.ctx.colorScheme.COLOR_INPUT_BG;
        this.input.style.fg = this.ctx.colorScheme.COLOR_INPUT_FG;
        this.input.style.bold = true;
        this.input.on("keypress", this.inputKeypress.bind(this));
        this.input.key(["C-backspace", "M-backspace"], () => {
            this.searchValue = "";
        });
        this.input.on("submit", () => {
            this.submit();
        });
        this.input.on("focus", () => {
            this.box.style.border.bg = this.ctx.colorScheme.COLOR_BORDER_BG_FOCUS;
            this.focus();
        });
        this.input.on("blur", () => {
            this.box.style.border.bg = this.ctx.colorScheme.COLOR_BORDER_BG;
        });

        this.list = blessed.list({
            parent: this.box,
            top: 2,
            left: 0,
            height: "100%-5",
            width: "100%-2",
            keyable: false,
            mouse: true,
            scrollbar: {
                ch: " ",
                track: {
                    bg: this.ctx.colorScheme.COLOR_SCROLLBAR_BG
                },
                style: {
                    inverse: true
                }
            },
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
            this.submit();
        });
        for (let value of this.values) {
            this.list.addItem(value);
        }
    }

    private submit() {
        let value = this.selectedItem;
        // this.close();
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

    public onBlur(callback: () => void) {
        this.input.on("blur", callback);
    }

    private reset() {
        this.search = "";
        this.filteredValues = this.values;
        this.selectedIndex = 0;
        this.selectedItem = this.filteredValues[0];
        this.input.setValue("");
    }

    // private close() {
    //     this.box.hide();
    //     this.reset();
    //     if (this.onCloseCallback) {
    //         this.onCloseCallback.call(null);
    //     }
    // }

    public destroy() {
        this.input.destroy();
        this.list.destroy();
        this.box.destroy();
    }

    private inputKeypress(ch: string, key: any) {
        if (key.name == "escape") {
            // this.close();
            // this.screen.render();
            this.screen.focusNext();
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
            if (!/^[\t\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
                this.search += ch;
            }
        }

        this.update();
    }

    public focus() {
        this.box.show();
        this.screen.render();
        this.input.readInput(() => {});
    }

    public setValues(values: string[]) {
        this.values = values;
        this.update();
    }

    public get searchValue() {
        return this.search;
    }

    public set searchValue(searchValue: string) {
        this.search = searchValue;
        this.input.setValue(this.search);
        this.update();
    }

    private update() {
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

    public select(index: number) {
        if (index < 0 || index >= this.values.length) {
            throw "Invalid argument";
        }
        let filteredIndex = this.filteredValues.indexOf(this.values[index]);
        if (filteredIndex == -1) {
            filteredIndex = 0;
        }
        this.selectedIndex = filteredIndex;
        this.selectedItem = this.values[index];

        this.list.select(this.selectedIndex);
        this.screen.render();
    }

    public key(name: string | string[], listener: (ch: any, key: blessed.Widgets.Events.IKeyEventArg) => void) {
        this.input.key(name, listener);
        // this.list.key(name, listener);
    }
}
