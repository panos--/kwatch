import * as blessed from "blessed";
import _ from "lodash";
import { AppDefaults } from "./app_defaults";

interface PromptOptions extends blessed.Widgets.PromptOptions {
    parent: blessed.Widgets.Node;
}

interface BoxOptions extends blessed.Widgets.BoxOptions {
    parent: blessed.Widgets.Node;
}

interface ListOptions<T> extends blessed.Widgets.ListOptions<T> {
    parent: blessed.Widgets.Node;
}

export class WidgetFactory {
    public static prompt(options: PromptOptions): blessed.Widgets.PromptElement {
        const screen = options.parent.screen;

        const prompt = blessed.prompt(_.merge({
            top: "center",
            left: "center",
            width: 100,
            height: 10,
            border: "line",
        }, options));

        prompt.data.input.style.bg = 12;
        prompt.data.input.style.fg = 16;
        prompt.data.okay.style.bg = 4;
        prompt.data.okay.style.fg = 15;
        prompt.data.cancel.style.bg = 4;
        prompt.data.cancel.style.fg = 15;
        prompt.data.cancel.padding.left = 1;

        prompt.on("focus", () => {
            prompt.style.border.bg = AppDefaults.COLOR_BG_FOCUS;
            screen.render();
        });
        prompt.on("blur", () => {
            prompt.style.border.bg = -1;
            screen.render();
        });

        return prompt;
    }

    public static textBox(options: BoxOptions): blessed.Widgets.BoxElement {
        const screen = options.parent.screen;

        const box = blessed.box(_.merge({
            top: 3,
            left: 5,
            height: "100%-6",
            width: "100%-10",
            mouse: true,
            keys: true,
            border: "line",
            scrollable: true,
            alwaysScroll: true,
            scrollbar:  {
                ch: " ",
                track: {
                    bg: "cyan"
                },
                style: {
                    inverse: true
                }
            },
        }, options));
        box.setIndex(100);
        box.key("pageup", () => {
            box.scroll(-(box.height / 2 | 0) || -1);
        });
        box.key("pagedown", () => {
            box.scroll(box.height / 2 | 0 || 1 );
        });
        box.key("escape", () => {
            box.destroy();
            screen.render();
        });
        return box;
    }

    public static list(label: string | null, values: string[],
        options: ListOptions<blessed.Widgets.ListElementStyle>,
        onSelect?: (item: string, index: number) => void) {
        if (values.length == 0) {
            throw "Invalid argument: values must not be empty";
        }
        const lengths = values.map(value => { return value.length; });
        let maxLength = Math.max.apply(null, lengths);
        const list = blessed.list(_.merge({
            label: label,
            top: "center",
            left: "center",
            width: Math.min(Math.max(maxLength, (label === null ? 0 : label.length) + 2, 10) + 2, 50),
            height: Math.min(values.length + 2, 20),
            mouse: true,
            keys: true,
            border: "line",
            items: values,
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
        }, options));
        list.style.border.bg = AppDefaults.COLOR_BG_FOCUS;
        list.on("blur", () => {
            list.hide();
            list.destroy();
        });
        list.on("cancel", () => {
            list.hide();
            list.destroy();
        });
        list.on("select", (item, index) => {
            list.hide();
            list.destroy();
            if (onSelect) {
                onSelect(values[index], index);
            }
        });
        return list;
    }
}
