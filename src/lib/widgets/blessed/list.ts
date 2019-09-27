import * as blessed from "blessed";

export class List extends blessed.widget.List {
    public constructor(options: blessed.Widgets.ListOptions<blessed.Widgets.ListElementStyle>) {
        super(options);
    }

    public getSelectedIndex() {
        return this.selected;
    }
}
