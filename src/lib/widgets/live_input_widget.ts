import * as blessed from "blessed";
import _ from "lodash";
import { AppContext } from "../app_context";

export interface LiveInputOptions extends blessed.Widgets.BoxOptions {
    parent: blessed.Widgets.Node;
}

export interface LiveInputWidget {
    _listener: (ch: string, key: any) => {};
}

export class LiveInputWidget extends blessed.widget.Textbox {
    private ctx: AppContext;
    private liveValue: string = "";

    private _origListener: (ch: string, key: any) => {} = null;

    public constructor(ctx: AppContext, options: LiveInputOptions) {
        super(_.merge({
            top: 0,
            left: 0,
            width: "100%-2",
            height: 1,
            style: {
                bg: "red"
            }
        }, options));
        this.ctx = ctx;
        this.init();
    }

    public get closeOnSubmit(): boolean {
        return !LiveInputWidget.prototype._origListener;
    }

    public set closeOnSubmit(closeOnSubmit: boolean) {
        if (closeOnSubmit) {
            if (this.closeOnSubmit) {
                return;
            }
            this._listener = this._origListener;
            this._origListener = null;
        }
        else {
            if (!this.closeOnSubmit) {
                return;
            }
            // Crude hack to prevent Textbox from destroying itself when receiving
            // "enter" key
            const self = this;
            this._origListener = this._listener;
            this._listener = function (ch, key) {
                if (key.name === "enter") {
                    self.emit("submit", self.liveValue);
                    return;
                }
                return this._origListener(ch, key); // must be called on "this", not "self"!
            };
        }
    }

    private init() {
        this.on("keypress", this.inputKeypress.bind(this));
        this.key(["C-backspace", "M-backspace"], () => {
            this.liveValue = "";
            this.setValue("");
            this.emit("change", this.liveValue);
            this.ctx.screen.render();
        });
        this.key("return", () => {
            this.value = this.value.replace(/\r/g, "");
        });
        this.key("tab", () => {
            this.value = this.value.replace(/\t/g, "");
        });
    }

    private inputKeypress(ch: string, key: any) {
        // NOTE: Taken from blessed (textarea.js)
        if (key.name === "backspace") {
            if (this.liveValue.length) {
                if (this.ctx.screen.fullUnicode) {
                    // NOTE: Would require unicode.js from blessed.js
                    // if (unicode.isSurrogate(this.value, this.value.length - 2)) {
                    //     // || unicode.isCombining(this.value, this.value.length - 1)) {
                    //     this.value = this.value.slice(0, -2);
                    // } else {
                    this.liveValue = this.liveValue.slice(0, -1);
                    // }
                } else {
                    this.liveValue = this.liveValue.slice(0, -1);
                }
                this.emit("change", this.liveValue);
            }
        } else if (ch) {
            if (!/^[\r\t\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
                this.liveValue += ch;
                this.emit("change", this.liveValue);
            }
        }
    }

    public setValue(value: string) {
        if (value !== null && value !== undefined) {
            this.liveValue = value;
        }
        super.setValue(value);
    }

    public getValue(): string {
        return this.liveValue;
    }
}
