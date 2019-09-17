import * as blessed from "blessed";
import { AppDefaults } from "../app_defaults";

export interface TopBarItemOptions {
    key: string;
    labelCallback: () => string;
    actionCallback: () => void;
}

interface TopBarItem extends TopBarItemOptions {
    box: blessed.Widgets.BoxElement;
}

export class TopBarWidget {
    private screen: blessed.Widgets.Screen;
    private parent: blessed.Widgets.Node;
    private topBar: blessed.Widgets.BoxElement;
    private items: TopBarItem[] = [];

    public constructor(parent: blessed.Widgets.Node) {
        this.parent = parent;
        this.screen = parent.screen;
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
            style: {
                fg: "white",
                bg: "magenta",
                hover: {
                    bg: "green"
                }
            }
        });
        this.topBar.style.bg = AppDefaults.COLOR_BG;
        this.topBar.style.fg = AppDefaults.COLOR_FG;
    }

    public update() {
        let currentOffset = 0;
        for (let item of this.items) {
            const label = item.labelCallback();
            item.box.left = currentOffset;
            item.box.width = label.length + 2; // include padding
            item.box.setText(label);
            currentOffset += item.box.width + 1;
        }
        this.screen.render();
    }

    private addItemInternal(itemOptions: TopBarItemOptions) {
        const itemBox = blessed.box({
            parent: this.topBar,
            top: 0,
            left: 0,
            width: 30,
            height: 1,
            padding: {
                left: 1,
                right: 1,
                top: 0,
                bottom: 0,
            },
            keys: false,
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
        this.screen.key([itemOptions.key], () => { itemOptions.actionCallback(); });
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
