import * as blessed from "blessed";
import _ from "lodash";
import { AppContext } from "../app_context";
import { SelectListWidget, OptionItem, OptionList } from "./select_list_widget";
import { LiveInputWidget } from "./live_input_widget";

interface DrilldownOptions extends blessed.Widgets.BoxOptions {
    parent: blessed.Widgets.Node;
    closeOnSubmit?: boolean;
}

export class DrilldownWidget<T> {
    private ctx: AppContext;
    private screen: blessed.Widgets.Screen;
    private box: blessed.Widgets.BoxElement;
    private input: LiveInputWidget;
    private values: OptionList<T>;
    private list: SelectListWidget<T>;
    private closeOnSubmit: boolean = true;

    private onSelectCallback: (value: T) => void;

    // private search = "";
    private filteredValues: OptionList<T>;

    public constructor(ctx: AppContext, values: OptionList<T>, options: DrilldownOptions) {
        this.ctx = ctx;
        this.screen = options.parent.screen;
        this.values = values;
        this.filteredValues = values;
        this.init(options);
        this.reset();
    }

    public init(options: DrilldownOptions) {
        let closeOnSubmit = options.closeOnSubmit;
        if (closeOnSubmit !== undefined && closeOnSubmit !== null) {
            this.closeOnSubmit = !!closeOnSubmit;
        }

        this.box = blessed.box(_.merge({
            top: "center",
            left: "center",
            height: 15,
            width: 50,
            border: "line",
            padding: {
                top: 1,
            }
        }, options));
        this.box.style.border.bg = this.ctx.colorScheme.COLOR_BORDER_BG;

        this.input = new LiveInputWidget(this.ctx, {
            parent: this.box,
            top: 0,
            left: 0,
            height: 1,
            width: "100%-2",
        });
        this.input.closeOnSubmit = false;
        this.input.style.bg = this.ctx.colorScheme.COLOR_INPUT_BG;
        this.input.style.fg = this.ctx.colorScheme.COLOR_INPUT_FG;
        this.input.style.bold = true;
        this.input.key("up", () => {
            this.list.up(1);
            this.screen.render();
        });
        this.input.key("down", () => {
            this.list.down(1);
            this.screen.render();
        });
        this.input.on("change", () => {
            this.update();
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

        this.list = new SelectListWidget({
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
        this.setValues(this.values);
    }

    private submit() {
        const value = this.list.getSelectedValue();
        if (value === null) {
            this.focus();
            this.screen.render();
            return;
        }
        if (this.onSelectCallback) {
            this.onSelectCallback.call(null, this.list.getSelectedValue());
        }
        if (this.closeOnSubmit) {
            this.destroy();
            this.screen.render();
        }
    }

    public onSelect(callback: (value: T) => void) {
        this.onSelectCallback = callback;
    }

    public onBlur(callback: () => void) {
        this.input.on("blur", callback);
    }

    private reset() {
        // this.search = "";
        this.filteredValues = this.values;
        this.input.setValue("");
    }

    public destroy() {
        this.input.destroy();
        this.list.destroy();
        this.box.destroy();
    }

    public focus() {
        this.box.show();
        this.screen.render();
        this.input.readInput(() => {});
    }

    public setValues(values: OptionList<T>) {
        this.values = values;
        this.update();
    }

    public get searchValue() {
        return this.input.getValue();
    }

    public set searchValue(searchValue: string) {
        this.input.setValue(searchValue);
        this.update();
    }

    private update() {
        let prevSelectedItem = this.getSelectedItem();
        const searchValue = this.input.getValue();
        this.filteredValues = this.values.filterLabels(label => { return label.includes(searchValue); });
        this.list.options = this.filteredValues;
        this.select(prevSelectedItem);
        if (this.getSelectedItem() === null) {
            this.list.down(1);
        }
        this.screen.render();
    }

    public select(option: OptionItem<T>) {
        this.list.select(option);
        this.screen.render();
    }

    public selectValue(value: T) {
        this.list.selectValue(value);
    }

    public getSelectedValue(): T {
        return this.list.getSelectedValue();
    }

    public getSelectedItem(): OptionItem<T> {
        return this.list.getSelectedItem();
    }

    public key(name: string | string[], listener: (ch: any, key: blessed.Widgets.Events.IKeyEventArg) => void) {
        this.input.key(name, listener);
    }
}
