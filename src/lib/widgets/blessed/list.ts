import * as blessed from "blessed";
import { Widgets } from "blessed";

export interface List {
    height: number;
    width: number;
}

export class List extends blessed.widget.List {
    private onClickCallbacks: (() => void)[] = [];

    public constructor(options: Widgets.ListOptions<Widgets.ListElementStyle>) {
        super(options);

        if (options.keyable === true || options.keys === true) {
            this.key("home", () => {
                this.select(0);
                this.scrollTo(0);
            });
            this.key("end", () => {
                const dstIndex = this.children.length - 1;
                this.select(dstIndex);
                this.scrollTo(dstIndex);
            });
            this.key("pageup", () => {
                // NOTE: not correct but better than nothing (scroll jumps on refreshes...)
                const offset = -(this.height / 2 | 0) || -1;
                const dstIndex = this.getSelectedIndex() + offset;
                this.select(dstIndex);
                this.scrollTo(dstIndex);
            });
            this.key("pagedown", () => {
                // NOTE: not correct but better than nothing (scroll jumps on refreshes...)
                const offset = (this.height / 2 | 0) || -1;
                const dstIndex = this.getSelectedIndex() + offset;
                this.select(dstIndex);
                this.scrollTo(dstIndex);
            });
        }
    }

    public onClick(callback: () => void) {
        this.onClickCallbacks.push(callback);
    }

    public getSelectedIndex() {
        return this.selected;
    }

    public addItem(content: string): Widgets.BoxElement {
        const item = super.addItem(content);
        if (this.mouse) {
            for (let callback of this.onClickCallbacks) {
                item.on("click", callback);
            }
        }
        return item;
    }
}
