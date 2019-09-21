import * as blessed from "blessed";
import _ from "lodash";
import { ColorScheme } from "./color_scheme";

interface PromptOptions extends blessed.Widgets.PromptOptions {
    parent: blessed.Widgets.Node;
}

interface QuestionOptions extends blessed.Widgets.QuestionOptions {
    parent: blessed.Widgets.Node;
}

interface BoxOptions extends blessed.Widgets.BoxOptions {
    parent: blessed.Widgets.Node;
}

interface ListOptions<T> extends blessed.Widgets.ListOptions<T> {
    parent: blessed.Widgets.Node;
}

export class WidgetFactory {
    private colorScheme: ColorScheme;

    public constructor(colorScheme: ColorScheme) {
        this.colorScheme = colorScheme;
    }

    public prompt(options: PromptOptions): blessed.Widgets.PromptElement {
        const screen = options.parent.screen;

        const prompt = blessed.prompt(_.merge({
            top: "center",
            left: "center",
            width: 100,
            height: 10,
            border: "line",
            padding: {
                top: 1
            }
        }, options));
        prompt.style.border.bg = this.colorScheme.COLOR_BORDER_BG_FOCUS;

        prompt.data.input.style.bg = this.colorScheme.COLOR_INPUT_BG;
        prompt.data.input.style.fg = this.colorScheme.COLOR_INPUT_FG;
        prompt.data.input.style.bold = true;
        prompt.data.okay.style.bg = this.colorScheme.COLOR_BUTTON_BG;
        prompt.data.okay.style.fg = this.colorScheme.COLOR_BUTTON_FG;
        prompt.data.okay.style.bold = true;
        prompt.data.cancel.style.bg = this.colorScheme.COLOR_BUTTON_BG;
        prompt.data.cancel.style.fg = this.colorScheme.COLOR_BUTTON_FG;
        prompt.data.cancel.style.bold = true;
        prompt.data.cancel.padding.left = 1;

        prompt.on("focus", () => {
            // prompt.style.border.bg = this.colorScheme.COLOR_BORDER_BG_FOCUS;
            screen.render();
        });
        prompt.on("blur", () => {
            // prompt.style.border.bg = this.colorScheme.COLOR_BORDER_BG;
            screen.render();
        });

        return prompt;
    }

    public question(options: QuestionOptions) {
        const screen = options.parent.screen;

        let question = blessed.question(_.merge({
            top: "center",
            left: "center",
            height: 10,
            width: 40,
            mouse: true,
            keys: true,
            border: "line",
            padding: {
                top: 1
            }
        }, options));
        question.style.border.bg = this.colorScheme.COLOR_BORDER_BG_FOCUS;

        question.data.okay.style.bg = this.colorScheme.COLOR_BUTTON_BG;
        question.data.okay.style.fg = this.colorScheme.COLOR_BUTTON_FG;
        question.data.okay.style.bold = true;
        question.data.cancel.style.bg = this.colorScheme.COLOR_BUTTON_BG;
        question.data.cancel.style.fg = this.colorScheme.COLOR_BUTTON_FG;
        question.data.cancel.style.bold = true;
        question.data.cancel.padding.left = 1;

        question.on("focus", () => {
            question.style.border.bg = this.colorScheme.COLOR_BORDER_BG_FOCUS;
            screen.render();
        });
        question.on("blur", () => {
            question.style.border.bg = this.colorScheme.COLOR_BORDER_BG;
            screen.render();
        });

        return question;
    }

    public textBox(options: BoxOptions): blessed.Widgets.BoxElement {
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
                    bg: this.colorScheme.COLOR_SCROLLBAR_BG
                },
                style: {
                    inverse: true
                }
            },
        }, options));
        box.style.border.bg = this.colorScheme.COLOR_BORDER_BG_FOCUS;
        box.setIndex(100);
        box.key("pageup", () => {
            const height = (typeof box.height == "number" ? box.height : parseInt(box.height));
            box.scroll(-(height / 2 | 0) || -1);
        });
        box.key("pagedown", () => {
            const height = (typeof box.height == "number" ? box.height : parseInt(box.height));
            box.scroll(height / 2 | 0 || 1 );
        });
        box.key("escape", () => {
            box.destroy();
            screen.render();
        });
        return box;
    }

    public list(label: string | null, values: string[],
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
        list.style.border.bg = this.colorScheme.COLOR_BORDER_BG_FOCUS;
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
        list.key("home", () => {
            list.select(0);
        });
        list.key("end", () => {
            list.select(values.length - 1);
        });
        return list;
    }
}
