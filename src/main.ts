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
import { DrilldownWidget } from "./lib/widgets/drilldown_widget";
import { AppContext } from "./lib/app_context";
import { LightColorScheme, DarkColorScheme, ColorScheme } from "./lib/color_scheme";

class App {
    private ctx: AppContext;

    private topBar: TopBarWidget;
    private apiList: DrilldownWidget;
    private resourceListWidget: ResourceListWidget;

    private stateFile: string;

    private constructor(ctx: AppContext) {
        this.ctx = ctx;
        this.stateFile = process.env.XDG_CONFIG_HOME || (process.env.HOME + "/.config") + "/kui/state.json";
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

    private async updateApiList(doneCb: () => void) {
        this.ctx.client.getListableAPIResources((error, resources) => {
            if (error) {
                console.log(error);
                return;
            }
            // update state
            this.ctx.state.apiResources = resources;
            let index = -1;
            if (this.ctx.state.apiResource !== null) {
                index = resources.findIndex(resource => {
                    return resource.resource.name == this.ctx.state.apiResource.resource.name;
                });
            }
            if (index == -1) {
                index = 0;
            }
            this.ctx.state.apiResource = resources[index];
            this.apiList.setValues(resources.map(r => { return r.getLongName(); }));
            this.apiList.select(index);
            doneCb();
        }).catch(e => {
            console.log(e);
        });
    }

    private updateContents() {
        this.updateNamespaceList(() => {
            this.ctx.screen.render();
        });
        this.updateApiList(() => {
            this.ctx.screen.render();
        });
    }

    private main() {
        const self = this;

        let logDir = (process.env.XDG_CACHE_HOME || process.env.HOME + "/.cache") + "/kui";
        fs.mkdirSync(logDir, {recursive: true, mode: 0o750});
        let logFile = logDir + "/kui.log";

        this.ctx.screen = blessed.screen({
            smartCSR: true,
            log: logFile,
        });

        try {
            this.loadAppState();
        } catch (e) {
            this.ctx.screen.log(`Could not load config: ${e.toString()}`);
        }

        this.ctx.screen.title = "KUI";

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
                return `[C]ontext: ${this.ctx.kubeConfig.getCurrentContext()}`;
            },
            actionCallback: () => {
                const contexts = this.ctx.kubeConfig.getContexts();
                const currentContext = this.ctx.kubeConfig.getCurrentContext();
                const currentIndex = contexts.findIndex(context => { return context.name == currentContext; });
                const list = this.ctx.widgetFactory.list(
                    "Choose Context",
                    contexts.map(context => { return context.name; }),
                    {
                        parent: box,
                    },
                    (context, index) => {
                        this.ctx.kubeConfig.setCurrentContext(contexts[index].name);
                        this.ctx.client.kubeConfig = this.ctx.kubeConfig;
                        childProcess.execFile("kubectl", [
                            "config", "use-context", contexts[index].name
                        ], {
                            encoding: null,
                        }, (error) => {
                            // cb(error, stdout.toLocaleString().split("\n"));
                            if (error) {
                                throw error;
                            }
                        });
                        this.topBar.update();
                        this.updateContents();
                        this.resourceListWidget.refresh();
                    });
                if (currentIndex != -1) {
                    list.select(currentIndex);
                }
                list.focus();
            },
        },{
            key: "n",
            labelCallback: () => {
                return `[N]amespace: ${this.ctx.state.namespace ? this.ctx.state.namespace.metadata.name : "n/a"}`;
            },
            actionCallback: () => {
                this.resourceListWidget.freeze();
                this.ctx.screen.saveFocus();
                const list = new DrilldownWidget(this.ctx,
                    this.ctx.state.namespaces.map(n => { return n.metadata.name; }), {
                        parent: this.ctx.screen,
                        label: "Choose Namespace",
                    });
                list.onSelect((value, index) => {
                    this.ctx.state.namespace = this.ctx.state.namespaces[index];
                    this.topBar.update();
                    this.resourceListWidget.refresh();
                });
                list.onBlur(() => {
                    list.destroy();
                    this.ctx.screen.restoreFocus();
                    this.resourceListWidget.unfreeze();
                });
                list.focus();
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

        this.apiList = new DrilldownWidget(this.ctx, [], {
            label: "API Resources",
            parent: leftPane,
            top: 0,
            left: 0,
            width: "100%",
            height: "100%-1",
        });
        this.apiList.onSelect((value: string, index: number) => {
            if (index == -1) {
                this.ctx.state.apiResource = null;
            }
            else {
                this.ctx.state.apiResource = this.ctx.state.apiResources[index];
            }
            this.resourceListWidget.refresh();
            this.ctx.screen.focusNext();
        });
        this.apiList.key("tab", () => {
            // NOTE: crude hack
            this.apiList.searchValue = this.apiList.searchValue.replace("\t", "");
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

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.ctx.screen.key(["C-r"], (ch, key) => {
            self.updateContents();
        });

        this.ctx.screen.key(["C-l"], () => {
            // FIXME: dirty redraw hack
            box.hide();
            this.ctx.screen.render();
            box.show();
            this.ctx.screen.render();
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.ctx.screen.key(["q", "C-c", "C-q"], (ch, key) => {
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

        this.ctx.screen.key(["?", "h", "f1"], () => {
            this.help();
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

            API resource list

                ESCAPE ............ Switch focus to resource list
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
