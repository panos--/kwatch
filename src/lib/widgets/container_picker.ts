import * as blessed from "blessed";
import { AppDefaults } from "../app_defaults";

export class ContainerPicker {
    private containers: string[];
    private parent: blessed.Widgets.Node;
    private containerMenu: blessed.Widgets.ListElement;
    private onSelectCallback: (container: string) => void

    public constructor(containers: string[], parent: blessed.Widgets.Node) {
        this.containers = containers;
        this.parent = parent;
        this.init();
    }

    private init() {
        const lengths = this.containers.map(value => { return value.length; });
        let maxLength = Math.max.apply(null, lengths);
        const label = "Choose Container";
        this.containerMenu = blessed.list({
            parent: this.parent,
            label: label,
            top: "center",
            left: "center",
            width: Math.min(Math.max(maxLength, label.length + 2) + 2, 50),
            height: 8,
            mouse: true,
            keys: true,
            border: "line",
            items: this.containers,
            shrink: true,
            style: {
                item: {
                    hover: {
                        bg: "blue",
                        fg: "white",
                    }
                },
                selected: {
                    bg: "blue",
                    fg: "white",
                    bold: true
                }
            },
        });
        this.containerMenu.style.border.bg = AppDefaults.COLOR_BORDER_BG_FOCUS;
        this.containerMenu.on("blur", () => {
            this.containerMenu.hide();
            this.containerMenu.destroy();
        });
        this.containerMenu.on("cancel", () => {
            this.containerMenu.hide();
            this.containerMenu.destroy();
        });
        this.containerMenu.on("select", (item, index) => {
            this.containerMenu.hide();
            this.containerMenu.destroy();
            if (this.onSelectCallback) {
                this.onSelectCallback(this.containers[index]);
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
