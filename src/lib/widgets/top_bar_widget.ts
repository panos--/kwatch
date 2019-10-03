import * as blessed from "blessed";
import { AppContext } from "../app_context";
import { Widgets } from "blessed";

export interface TopBarItemOptions {
    key: string;
    labelCallback: () => string;
    actionCallback: () => void;
}

interface TopBarItem extends TopBarItemOptions {
    box: blessed.Widgets.BoxElement;
}

export class TopBarWidget {
    private ctx: AppContext;
    private parent: blessed.Widgets.Node;
    private topBar: blessed.Widgets.BoxElement;
    private items: TopBarItem[] = [];

    public constructor(ctx: AppContext, parent: blessed.Widgets.Node) {
        this.ctx = ctx;
        this.parent = parent;
        this.init();
    }

    public init() {
        this.topBar = blessed.box({
            parent: this.parent,
            top: 0,
            left: 0,
            width: "100%",
            height: 1,
            tags: true,
            focusable: false,
            keys: false,
            mouse: true,
            style: {
                fg: "white",
                bg: "magenta",
            }
        });
        this.topBar.style.bg = this.ctx.colorScheme.COLOR_BG;
        this.topBar.style.fg = this.ctx.colorScheme.COLOR_FG;
    }

    public update() {
        let currentOffset = 0;
        for (let item of this.items) {
            const label = item.labelCallback();
            item.box.left = currentOffset;
            item.box.setContent(label);
            currentOffset += item.box.getText().length + 2 + 1;
        }
        this.ctx.screen.render();
    }

    private addItemInternal(itemOptions: TopBarItemOptions) {
        const itemBox = blessed.box({
            parent: this.topBar,
            top: 0,
            left: 0,
            width: "shrink",
            height: 1,
            padding: {
                left: 1,
                right: 1,
                top: 0,
                bottom: 0,
            },
            tags: true,
            wrap: false,
            keys: false,
            mouse: false,
            focusable: false,
            style: {
                fg: "white",
                bg: "blue",
                bold: true,
                hover: {
                    bg: "lightblue"
                }
            }
        });
        this.items.push({
            key: itemOptions.key,
            labelCallback: itemOptions.labelCallback,
            actionCallback: itemOptions.actionCallback,
            box: itemBox,
        });
        this.ctx.screen.key([itemOptions.key], () => {
            itemOptions.actionCallback();
        });
        itemBox.on("click", () => {
            process.nextTick(() => {
                this.ctx.screen.focusPop(); // remove clicked button from focus stack
                itemOptions.actionCallback();
            });
        });
    }

    public addItem(itemOptions: TopBarItemOptions) {
        this.addItemInternal(itemOptions);
        this.update();
    }

    public addItems(itemOptions: TopBarItemOptions[]) {
        for (let item of itemOptions) {
            this.addItemInternal(item);
        }
        this.update();
    }
}
