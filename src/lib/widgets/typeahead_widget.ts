import * as blessed from "blessed";
import _ from "lodash";
import { AppContext } from "../app_context";
import { LiveInputWidget } from "./live_input_widget";
import { EventEmitter } from "events";
import { Widgets } from "blessed";

export interface TypeaheadOptions extends blessed.Widgets.BoxOptions {
    parent: blessed.Widgets.Node;
}

export class TypeaheadWidget {
    private ctx: AppContext;
    private box: blessed.Widgets.BoxElement;
    private input: LiveInputWidget;
    private eventEmitter: EventEmitter;

    public constructor(ctx: AppContext, options: Widgets.BoxOptions) {
        this.ctx = ctx;
        this.eventEmitter = new EventEmitter();
        this.init(options);
    }

    private init(options: Widgets.BoxOptions) {
        this.box = blessed.box(_.merge({
            top: "100%-4",
            left: "100%-27",
            height: 3,
            width: 25,
            style: {
                bg: "black",
            },
            border: { type: "line", bg: this.ctx.colorScheme.COLOR_BORDER_BG_FOCUS },
        }, options));
        // this.box.show();
        // this.box.setIndex(100);
        // console.log("HERE");

        this.input = new LiveInputWidget(this.ctx, {
            parent: this.box,
            // border: "line",
            style: {
                bg: "cyan",
            }
        });
        this.input.on("keypress", this.inputKeypress.bind(this));
        this.input.on("change", (search: string) => {
            this.search(search, { forward: true, next: false });
        });
        this.input.key("f3", () => {
            this.search(this.input.getValue(), { forward: true, next: true });
        });
        this.input.key("S-f3", () => {
            this.search(this.input.getValue(), { forward: false, next: true });
        });
        this.input.key("escape", () => {
            this.destroy();
        });

        this.ctx.screen.render();

        // console.log(this.input);
    }

    private search(search: string, options: { forward: boolean; next: boolean }) {
        const ret = { found: false };
        this.eventEmitter.emit("search", search, options, ret);
        this.input.style.bg = ret.found ? this.ctx.colorScheme.COLOR_INPUT_BG : 9;
    }

    private inputKeypress(ch: string, key: any) {
        this.eventEmitter.emit("keypress", ch, key);
        if (key.name == "escape" || key.name == "enter") {
            this.destroy();
        }
    };

    public on(event: "keypress" | "search", listener: (...args: any) => any) {
        this.eventEmitter.on(event, listener);
    }

    private destroy() {
        this.input.destroy();
        this.box.destroy();
        this.ctx.screen.render();
    }
}
