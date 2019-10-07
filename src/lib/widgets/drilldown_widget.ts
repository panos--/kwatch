import * as blessed from "blessed";
import _ from "lodash";
import { AppViewContext } from "../app_context";
import { SelectListWidget, OptionItem, OptionList } from "./select_list_widget";
import { LiveInputWidget } from "./live_input_widget";
import { EventEmitter } from "events";
import { MatcherBuilder } from "../search/matcher_builder";

class DefaultMatcherBuilder implements MatcherBuilder {
    public matcher(search: string) {
        return {
            test: function(subject: string): boolean {
                return subject.includes(search);
            }
        };
    }
}

interface DrilldownOptions extends blessed.Widgets.BoxOptions {
    parent: blessed.Widgets.Node;
}

export class DrilldownWidget<T> {
    private ctx: AppViewContext;
    private screen: blessed.Widgets.Screen;
    private box: blessed.Widgets.BoxElement;
    private input: LiveInputWidget;
    private values: OptionList<T>;
    private filteredValues: OptionList<T>;
    private list: SelectListWidget<T>;
    private eventEmitter = new EventEmitter();
    private matcherBuilder = new DefaultMatcherBuilder();

    public constructor(ctx: AppViewContext, values: OptionList<T>, options: DrilldownOptions) {
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
        this.input.key("home", () => {
            this.list.selectIndex(0);
            this.screen.render();
        });
        this.input.key("end", () => {
            this.list.selectIndex(this.filteredValues.toArray().length - 1);
            this.screen.render();
        });
        this.input.key("pagedown", () => {
            this.list.down(Math.round(this.list.height / 2));
            this.screen.render();
        });
        this.input.key("pageup", () => {
            this.list.up(Math.round(this.list.height / 2));
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
            this._focus();
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
        this.list.onSubmit(() => {
            this.submit();
        });
        this.list.onClick(() => {
            this.input.focus();
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
        this.eventEmitter.emit("select", value);
    }

    public onSubmit(callback: (value: T) => void) {
        this.eventEmitter.on("select", callback);
    }

    public onBlur(callback: () => void) {
        this.input.on("blur", () => {
            if (this.screen.focused === this.box
                || this.screen.focused.hasAncestor(this.box)) {
                return;
            }
            callback();
        });
    }

    private reset() {
        this.filteredValues = this.values;
        this.input.setValue("");
    }

    public show() {
        this.box.show();
    }

    public hide() {
        this.input.blur();
        this.box.hide();
        this.screen.focusPop();
    }

    public destroy() {
        this.input.destroy();
        this.list.destroy();
        this.box.destroy();
        this.screen.render();
    }

    public _focus() {
        if (this.box.visible) {
            this.screen.render();
            this.input.readInput(() => {});
        }
    }

    public focus() {
        if (this.box.visible) {
            this.input.focus();
        }
    }

    public setValues(values: OptionList<T>) {
        this.values = values;
        this.update();
    }

    public setMatcherBuilder(matcherBuilder: MatcherBuilder) {
        this.matcherBuilder = matcherBuilder;
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
        const matcher = this.matcherBuilder.matcher(this.input.getValue());
        this.filteredValues = this.values.filterLabels(label => { return matcher.test(label); });
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

    public get height(): number {
        return typeof this.box.height == "number" ? this.box.height : parseInt(this.box.height);
    }

    public set height(height: number) {
        this.box.height = height;
    }

    public get width(): number {
        return typeof this.box.width == "number" ? this.box.width : parseInt(this.box.width);
    }

    public set width(width: number) {
        this.box.width = width;
    }
}
