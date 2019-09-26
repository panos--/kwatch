import * as blessed from "blessed";

declare module "blessed" {
    export namespace Widgets {
        interface ListElement {
            selected: number;
        }
    }

    export namespace widget {
        class List extends blessed.Widgets.ListElement {}
        class Textbox extends blessed.Widgets.TextboxElement {}
    }
}
