import * as blessed from "blessed";
import { AppContext } from "../app_context";

export class ContainerPicker {
    private ctx: AppContext;
    private containers: string[];
    private parent: blessed.Widgets.Node;
    private containerMenu: blessed.Widgets.ListElement;
    private onSelectCallback: (container: string) => void

    public constructor(ctx: AppContext, containers: string[], parent: blessed.Widgets.Node) {
        this.ctx = ctx;
        this.containers = containers;
        this.parent = parent;
        this.init();
    }

    private init() {
        this.containerMenu = this.ctx.widgetFactory.list("Choose Container", this.containers, {
            parent: this.parent,
            mouse: true,
            keys: true,
        }, (container) => {
            if (this.onSelectCallback) {
                this.onSelectCallback.call(null, container);
            }
        });
    }

    public onSelect(onSelectCallback: (container: string) => void) {
        this.onSelectCallback = onSelectCallback;
    }

    public show() {
        this.containerMenu.screen.saveFocus();
        this.containerMenu.focus();
        this.containerMenu.show();
        this.containerMenu.select(0);
        this.containerMenu.screen.render();
    }
}
