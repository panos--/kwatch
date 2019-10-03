#!/usr/bin/env node

import yargs from "yargs";
import * as fs from "fs";
import * as path from "path";
import childProcess from "child_process";
import * as k8s from "@kubernetes/client-node";
import * as blessed from "blessed";
import * as k8sClient from "./lib/client";
import { ResourceListWidget } from "./lib/widgets/resource_list_widget";
import { WidgetFactory } from "./lib/widget_factory";
import { TopBarWidget } from "./lib/widgets/top_bar_widget";
import { AppContext, AppState } from "./lib/app_context";
import { LightColorScheme, DarkColorScheme, ColorScheme } from "./lib/color_scheme";
import { APIResource } from "./lib/client";
import { APIListWidget } from "./lib/widgets/api_list_widget";
import { NamespaceListWidget } from "./lib/widgets/namespace_list_widget";
import { DrilldownWidget } from "./lib/widgets/drilldown_widget";
import { OptionList } from "./lib/widgets/select_list_widget";
import { Context } from "@kubernetes/client-node/dist/config_types";
import { LooseMatcherBuilder } from "./lib/search/loose_matcher";

class App {
    private ctx: AppContext;

    private topBar: TopBarWidget;
    private apiList: APIListWidget;
    private resourceListWidget: ResourceListWidget;

    private stateFile: string;

    private constructor(ctx: AppContext) {
        this.ctx = ctx;
        this.stateFile = process.env.XDG_CONFIG_HOME || (process.env.HOME + "/.config") + "/kwatch/state.json";
    }

    private saveAppState() {
        let data = JSON.stringify(this.ctx.state, null, 2);
        let dir = path.dirname(this.stateFile);
        fs.mkdirSync(dir, {recursive: true, mode: 0o750});
        fs.writeFileSync(this.stateFile, data);
    }

    private loadAppState() {
        let data = fs.readFileSync(this.stateFile);
        this.ctx.state = JSON.parse(data.toString());
        AppState.unserialize(this.ctx.state);
    }

    private async updateNamespaceList(doneCb: () => void) {
        this.ctx.client.getNamespaces((error, namespaces) => {
            if (error) {
                console.log("Error updating namespace list:", error);
                return;
            }
            // update state
            this.ctx.state.namespaces = namespaces;
            let index = -1;
            if (this.ctx.state.namespace !== null) {
                index = namespaces.findIndex(namespace => {
                    return namespace.metadata.name == this.ctx.state.namespace.metadata.name;
                });
            }
            if (index == -1) {
                index = 0;
            }
            this.ctx.state.namespace = namespaces[index];
            this.topBar.update();
            doneCb();
        });
    }

    private updateContents() {
        this.updateNamespaceList(() => {
            this.ctx.screen.render();
        });
        this.apiList.updateApiList();
    }

    private main() {
        let logDir = (process.env.XDG_CACHE_HOME || process.env.HOME + "/.cache") + "/kwatch";
        fs.mkdirSync(logDir, {recursive: true, mode: 0o750});
        let logFile = logDir + "/kwatch.log";

        this.ctx.screen = blessed.screen({
            smartCSR: true,
            log: logFile,
        });

        try {
            this.loadAppState();
        } catch (e) {
            this.ctx.screen.log(`Could not load config: ${e.toString()}`);
        }

        this.ctx.screen.title = "kwatch";

        var box = blessed.box({
            parent: this.ctx.screen,
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            tags: true,
            focusable: false,
        });
        box.style.bg = this.ctx.colorScheme.COLOR_BG;
        box.style.fg = this.ctx.colorScheme.COLOR_FG;

        this.topBar = new TopBarWidget(this.ctx, box);
        this.topBar.addItems([{
            key: "c",
            labelCallback: () => {
                const labelValue = this.ctx.kubeConfig.getCurrentContext();
                return `{yellow-fg}C{/yellow-fg}{cyan-fg}ontext:{/cyan-fg} ${blessed.escape(labelValue)}`;
            },
            actionCallback: () => {
                const contexts = this.ctx.kubeConfig.getContexts();
                const currentContextName = this.ctx.kubeConfig.getCurrentContext();
                const currentContext = contexts.find(context => {
                    return context.name == currentContextName;
                });
                const options = new OptionList<any>();
                for (let context of contexts) {
                    options.addOption({
                        label: context.name,
                        value: context,
                    });
                }
                const maxLength = Math.max.apply(null, contexts.map(context => context.name.length));
                const screenWidth: any = this.ctx.screen.width;
                let drilldown = new DrilldownWidget<Context>(this.ctx, options, {
                    parent: this.ctx.screen,
                    label: "Choose Context",
                    width: Math.max(20, Math.min(maxLength + 3, screenWidth - 10)),
                });
                drilldown.setMatcherBuilder(new LooseMatcherBuilder());
                drilldown.key("escape", () => { drilldown.destroy(); });
                drilldown.onSubmit(context => {
                    this.ctx.kubeConfig.setCurrentContext(context.name);
                    this.ctx.client.kubeConfig = this.ctx.kubeConfig;
                    childProcess.execFile("kubectl", [
                        "config", "use-context", context.name
                    ], {
                        encoding: null,
                    }, (error) => {
                        if (error) {
                            throw error;
                        }
                    });
                    this.topBar.update();
                    this.updateContents();
                    this.resourceListWidget.unfreeze();
                    this.resourceListWidget.refresh();
                    process.nextTick(() => {
                        drilldown.destroy();
                    });
                });
                drilldown.onBlur(() => {
                    drilldown.destroy();
                    this.resourceListWidget.unfreeze();
                });
                drilldown.selectValue(currentContext);
                drilldown.focus();
            },
        },{
            key: "n",
            labelCallback: () => {
                const labelValue = this.ctx.state.namespace ? this.ctx.state.namespace.metadata.name : "n/a";
                return `{yellow-fg}N{/yellow-fg}{cyan-fg}amespace:{/cyan-fg} ${blessed.escape(labelValue)}`;
            },
            actionCallback: () => {
                this.resourceListWidget.freeze();
                this.ctx.screen.saveFocus();
                const namespaceListWidget = new NamespaceListWidget(this.ctx);
                namespaceListWidget.onSelect(() => {
                    this.topBar.update();
                    this.resourceListWidget.refresh();
                    this.resourceListWidget.unfreeze();
                });
                namespaceListWidget.onClose(() => {
                    this.ctx.screen.restoreFocus();
                    this.resourceListWidget.unfreeze();
                });
                namespaceListWidget.focus();
            },
        },{
            key: ["h", "?", "f1"],
            labelCallback: () => {
                return "{yellow-fg}H{/yellow-fg}{cyan-fg}elp{/cyan-fg}";
            },
            actionCallback: () => {
                this.help();
            }
        }]);

        var leftPane = blessed.box({
            parent: box,
            top: 1,
            left: 0,
            width: 30,
            height: "100%",
            focusable: false,
        });

        this.apiList = new APIListWidget(this.ctx, leftPane);
        this.apiList.onSelect((apiResource: APIResource) => {
            this.ctx.state.apiResource = apiResource;
            this.resourceListWidget.refresh();
            this.ctx.screen.focusNext();
        });
        this.apiList.key("tab", () => {
            this.resourceListWidget.focus();
        });

        var mainPane = blessed.box({
            parent: box,
            top: 1,
            left: 30,
            width: "100%-30",
            height: "100%-1",
            keys: false,
            alwaysScroll:true,
            scrollable: true,
            style: {
                fg: "white",
                bg: "blue",
                hover: {
                    bg: "green"
                }
            }
        });

        this.resourceListWidget = new ResourceListWidget(this.ctx);
        this.resourceListWidget.appendTo(mainPane);

        this.ctx.screen.key(["C-r"], () => {
            this.updateContents();
        });

        this.ctx.screen.key(["C-l"], () => {
            // FIXME: dirty redraw hack
            box.hide();
            this.ctx.screen.render();
            box.show();
            this.ctx.screen.render();
        });

        this.ctx.screen.key(["q", "C-c", "C-q"], () => {
            this.saveAppState();
            return process.exit(0);
        });

        this.ctx.screen.key(["tab"], () => {
            this.ctx.screen.focusNext();
        });
        this.ctx.screen.key(["S-tab"], () => {
            this.ctx.screen.focusPrevious();
        });

        this.ctx.screen.key(["]"], () => {
            this.resourceListWidget.cycleRefreshSlower();
        });

        this.ctx.screen.key(["["], () => {
            this.resourceListWidget.cycleRefreshFaster();
        });

        this.ctx.screen.key(["space"], () => {
            this.resourceListWidget.pause();
        });

        this.ctx.screen.render();
        this.resourceListWidget.focus();
        this.updateContents();
    }

    private help() {
        this.resourceListWidget.freeze();
        const helpBox = this.ctx.widgetFactory.textBox({
            parent: this.ctx.screen,
            label: "Keyboard Shortcuts",
            top: "center",
            left: "center",
            width: 72,
            height: 24,
        });
        this.ctx.screen.grabKeys = true;
        helpBox.key("escape", () => {
            helpBox.destroy();
            this.ctx.screen.grabKeys = false;
            this.resourceListWidget.unfreeze();
        });

        let helpText = `
            Global shortcuts

                TAB, Shift TAB .... Cycle focus between left pane
                                    and resource list
                [, ] .............. Cycle refresh rate of resource
                                    list faster, slower
                SPACE ............. Pause resource list refresh
                c ................. Choose kubernetes context
                n ................. Choose namespace
                CTRL-r ............ Refresh API resource list and
                                    namespace list
                CTRL-l ............ Redraw screen
                ?, h, F1 .......... Show this help screen
                q, CTRL-c, CTRL-q . Quit, exit program

            Resource list

                ENTER ............. Show action menu for selected
                                    resource
                UP, DOWN,
                PAGEUP, PAGEDOWN,
                HOME, END ......... Navigate through list
                / ................. Activate typeahead find

            Resource list / Typeahead find

                ENTER, DOWN ....... Find next
                UP ................ Find previous
                ESCAPE ............ Close typeahead find

            API resource list

                TAB ............... Switch focus to resource list
                UP, DOWN,
                PAGEUP, PAGEDOWN,
                HOME, END, ........ Navigate through list
        `.replace(/\n         /g, "\n").replace("\n", "");
        helpBox.insertBottom(helpText);
        helpBox.focus();
    }

    public static run(argv0: string, argv: string[]) {
        const args = yargs
            .usage("usage: $0 [options]")
            .string("color-scheme")
            .alias("c", "color-scheme")
            .choices("color-scheme", ["light", "dark"])
            .default("color-scheme", "light")
            .describe("color-scheme", "Specify color scheme: light, dark")
            .alias("h", "help")
            .parse(argv);

        const colorSchemes: {[index: string]: ColorScheme} = {
            light: new LightColorScheme(),
            dark: new DarkColorScheme(),
        };
        const colorScheme = colorSchemes[args["color-scheme"]];
        if (!colorScheme) {
            throw "undefined color-scheme";
        }

        const ctx = new AppContext();
        ctx.state = new AppState();
        ctx.kubeConfig = new k8s.KubeConfig();
        ctx.kubeConfig.loadFromDefault();
        ctx.client = new k8sClient.K8sClient(ctx.kubeConfig);
        ctx.colorScheme = colorScheme;
        ctx.widgetFactory = new WidgetFactory(ctx.colorScheme);
        ctx.pager = process.env.PAGER || "less";

        const app = new App(ctx);
        app.main();
    }
}

App.run(process.argv0, process.argv);
