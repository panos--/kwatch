import * as blessed from "blessed";
import _ from "lodash";
import { AppDefaults } from "./app_defaults";

interface PromptOptions extends blessed.Widgets.PromptOptions {
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
}
