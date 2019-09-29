import * as blessed from "blessed";
import _ from "lodash";
import { AppContext } from "../app_context";
import { LiveInputWidget } from "./live_input_widget";
import { EventEmitter } from "events";
import { Widgets } from "blessed";

export interface TypeaheadOptions extends blessed.Widgets.BoxOptions {
    parent: blessed.Widgets.Node;
}

export enum SearchDirection {
    Forward = 1,
    Backward,
}

export class TypeaheadWidget {
    private ctx: AppContext;
    private box: blessed.Widgets.BoxElement;
    private input: LiveInputWidget;
    private eventEmitter: EventEmitter;
    private searchDirection: SearchDirection = SearchDirection.Forward;

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

        this.input = new LiveInputWidget(this.ctx, {
            parent: this.box,
            style: {
                bg: "cyan",
            }
        });
        this.input.key("escape", this.destroy.bind(this));
        this.input.on("keypress", this.inputKeypress.bind(this));
        this.input.on("change", (search: string) => {
            this.search(search, { forward: true, next: false });
        });
        const searchForward = () => {
            this.search(this.input.getValue(), { forward: true, next: true });
        };
        const searchBackward = () => {
            this.search(this.input.getValue(), { forward: false, next: true });
        };
        const searchInDirection = () => {
            this.searchDirection == SearchDirection.Forward
                ? searchForward()
                : searchBackward();
        };
        this.input.key("down", searchForward);
        this.input.key("up", searchBackward);
        this.input.key("enter", searchInDirection);
        this.input.closeOnSubmit = false;

        this.ctx.screen.render();
    }

    private search(search: string, options: { forward: boolean; next: boolean }) {
        const ret = { found: false };
        this.eventEmitter.emit("search", search, options, ret);
        this.input.style.bg = ret.found
            ? this.ctx.colorScheme.COLOR_INPUT_BG
            : this.ctx.colorScheme.COLOR_INPUT_BG_ERROR;
        this.ctx.screen.render();
    }

    private inputKeypress(ch: string, key: any) {
        this.eventEmitter.emit("keypress", ch, key);
    };

    public on(event: "keypress" | "search" | "destroy", listener: (...args: any) => any) {
        this.eventEmitter.on(event, listener);
    }

    public focus() {
        this.input.readInput(() => {});
    }

    private destroy() {
        this.input.destroy();
        this.box.destroy();
        this.ctx.screen.render();
        this.eventEmitter.emit("destroy");
    }
}
