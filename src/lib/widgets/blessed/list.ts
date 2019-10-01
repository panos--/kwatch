import * as blessed from "blessed";

export interface List {
    height: number;
    width: number;
}

export class List extends blessed.widget.List {
    public constructor(options: blessed.Widgets.ListOptions<blessed.Widgets.ListElementStyle>) {
        super(options);

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

    public getSelectedIndex() {
        return this.selected;
    }
}
