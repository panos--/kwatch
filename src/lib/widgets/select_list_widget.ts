import { Widgets } from "blessed";
import { List } from "./blessed/list";
import { EventEmitter } from "events";

export interface OptionItem<T> {
    label: string;
    value: T;
}
export interface OptionGroup<T> {
    label: string;
    options: OptionItem<T>[];
}

export type Option<T> = OptionItem<T>|OptionGroup<T>;

export class OptionList<T> implements Iterable<Option<T>> {
    private options: Option<T>[];

    public constructor() {
        this.options = [];
    }

    public addGroup(group: OptionGroup<T>) {
        this.options.push(group);
    }

    public addOption(option: OptionItem<T>) {
        this.options.push(option);
    }

    public *[Symbol.iterator]() {
        for (let optionOrGroup of this.options) {
            if (!("options" in optionOrGroup)) {
                yield optionOrGroup;
                continue;
            }

            yield optionOrGroup;
            for (let option of optionOrGroup.options) {
                yield option;
            }
        }
    }

    public filter(callback: (value: T) => boolean): OptionList<T> {
        const result = new OptionList<T>();
        for (let optionOrGroup of this.options) {
            if (!("options" in optionOrGroup)) {
                if (callback(optionOrGroup.value)) {
                    result.addOption(optionOrGroup);
                }
                continue;
            }

            const filteredOptions = optionOrGroup.options.filter(option => { return callback(option.value); });
            if (filteredOptions.length > 0) {
                result.addGroup({ label: optionOrGroup.label, options: filteredOptions });
            }
        }
        return result;
    }

    public filterLabels(callback: (label: string) => boolean): OptionList<T> {
        const result = new OptionList<T>();
        for (let optionOrGroup of this.options) {
            if (!("options" in optionOrGroup)) {
                if (callback(optionOrGroup.label)) {
                    result.addOption(optionOrGroup);
                }
                continue;
            }

            const filteredOptions = optionOrGroup.options.filter(option => { return callback(option.label); });
            if (filteredOptions.length > 0) {
                result.addGroup({ label: optionOrGroup.label, options: filteredOptions });
            }
        }
        return result;
    }

    public hasGroups(): boolean {
        for (let optionOrGroup of this.options) {
            if ("options" in optionOrGroup) {
                return true;
            }
        }
        return false;
    }

    public toArray() {
        const result: Option<T>[] = [];
        for (let option of this) {
            result.push(option);
        }
        return result;
    }
}

export class SelectListWidget<T> {
    private list: List;
    private optionList: OptionList<T>;
    private _options: Option<T>[];
    private eventEmitter = new EventEmitter();

    public constructor(options: Widgets.ListOptions<Widgets.ListElementStyle>) {
        if (options.items) {
            options.items = null;
        }
        this.list = new List(options);
        this.list.on("select", () => {
            this.eventEmitter.emit("submit", this.getSelectedValue());
        });
        this.optionList = new OptionList();
        this._options = [];
    }

    public get options(): OptionList<T> {
        return this.optionList;
    }

    public set options(options: OptionList<T>) {
        let groupPrefix = "➤ "; // ➤►▸▶
        let itemPrefix  = "  ╰ "; // ╰•
        if (!options.hasGroups()) {
            itemPrefix = "";
        }
        this.optionList = options;
        this._options = options.toArray();
        this.list.clearItems();
        for (let option of this._options) {
            this.list.addItem(("options" in option ? groupPrefix : itemPrefix) + option.label);
        }
    }

    public get node(): Widgets.Node {
        return this.list;
    }

    public getSelectedIndex(): number {
        return this.list.getSelectedIndex();
    }

    public setLabel(label: string | Widgets.LabelOptions) {
        this.list.setLabel(label);
    }

    public get height(): number {
        return typeof this.list.height == "number"
            ? this.list.height
            : parseInt(this.list.height);
    }

    public get width(): number {
        return typeof this.list.width == "number"
            ? this.list.width
            : parseInt(this.list.width);
    }

    public get style(): any {
        return this.list.style;
    }

    public onSubmit(callback: (value: T) => void) {
        this.eventEmitter.on("submit", callback);
    }

    public onBlur(callback: () => void) {
        this.list.on("blur", callback);
    }

    public onFocus(callback: () => void) {
        this.list.on("focus", callback);
    }

    public key(name: string | string[], listener: (ch: any, key: Widgets.Events.IKeyEventArg) => void) {
        return this.list.key(name, listener);
    }

    public focus() {
        this.list.focus();
    }

    /**
     * Select an index of an item.
     */
    public select(option: OptionItem<T>) {
        this.list.select(this._options.indexOf(option));
    }

    public selectValue(value: T) {
        this.list.select(this._options.findIndex(option => {
            if ("value" in option) {
                return option.value === value;
            }
            return false;
        }));
    }

    public selectIndex(index: number) {
        this.list.select(index);
    }

    public getSelectedOption(): Option<T>|null {
        const selectedItem = this._options[this.list.getSelectedIndex()];
        return selectedItem ? selectedItem : null;
    }

    public getSelectedItem(): OptionItem<T>|null {
        const selectedItem = this._options[this.list.getSelectedIndex()];
        // FIXME:
        if (selectedItem === undefined) {
            return null;
        }
        return "options" in selectedItem ? null : selectedItem;
    }

    public getSelectedValue(): T|null {
        const selectedItem = this.getSelectedItem();
        return selectedItem === null ? null : selectedItem.value;
    }

    /**
     * Select item based on current offset.
     */
    public move(offset: number) {
        this.list.move(offset);
    }

    /**
     * Select item above selected.
     */
    public up(amount: number) {
        this.list.up(amount);
    }

    /**
     * Select item below selected.
     */
    public down(amount: number) {
        this.list.down(amount);
    }

    /**
     * The offset of the top of the scroll content.
     */
    public get childBase(): number {
        return this.list.childBase;
    }

    /**
     * The offset of the chosen item/line.
     */
    public get childOffset(): number {
        return this.list.childOffset;
    }

    /**
     * Scroll the content by a relative offset.
     */
    public scroll(offset: number, always?: boolean) {
        return this.list.scroll(offset, always);
    }

    /**
     * Scroll the content to an absolute index.
     */
    public scrollTo(index: number) {
        return this.list.scrollTo(index);
    }

    /**
     * Same as scrollTo.
     */
    public setScroll(index: number) {
        this.list.setScroll(index);
    }

    /**
     * Set the current scroll index in percentage (0-100).
     */
    public setScrollPerc(perc: number) {
        this.list.setScrollPerc(perc);
    }

    /**
     * Get the current scroll index in lines.
     */
    public getScroll(): number {
        return this.list.getScroll();
    }

    /**
     * Get the actual height of the scrolling area.
     */
    public getScrollHeight(): number {
        return this.list.getScrollHeight();
    }

    /**
     * Get the current scroll index in percentage.
     */
    public getScrollPerc(): number {
        return this.list.getScrollPerc();
    }

    /**
     * Reset the scroll index to its initial state.
     */
    public resetScroll() {
        return this.list.resetScroll();
    }

    public destroy() {
        this.list.destroy();
    }
}
