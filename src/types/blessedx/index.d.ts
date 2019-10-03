import * as blessed from "blessed";

declare module "blessed" {
    export namespace Widgets {
        interface ListElement {
            selected: number;
            mouse: boolean;
            addItem(content: string|blessed.Widgets.Node): blessed.Widgets.BoxElement;
        }

        interface BoxOptions {
            wrap?: boolean;
        }
    }

    export namespace widget {
        class List extends blessed.Widgets.ListElement {}
        class Textbox extends blessed.Widgets.TextboxElement {}
    }
}
