import { Widgets } from "blessed";
import { List } from "./blessed/list";

export interface Payload<T> {
    label: string;
    value: T;
}

export class PayloadListWidget<T> {
    private list: List;
    private _values: Payload<T>[];

    public constructor(options: Widgets.ListOptions<Widgets.ListElementStyle>) {
        if (options.items) {
            options.items = null;
        }
        this.list = new List(options);
    }

    public get values(): Payload<T>[] {
        return this._values;
    }

    public set values(values: Payload<T>[]) {
        this._values = [];
        this.list.clearItems();
        for (let value of values) {
            this._values.push(value);
            this.list.addItem(value.label);
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

    public on(event: string, listener: (...args: any[]) => void) {
        return this.list.on(event, listener);
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
    public select(index: number) {
        this.list.select(index);
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
}
