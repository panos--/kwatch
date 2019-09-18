import * as fs from "fs";
import * as path from "path";
import childProcess from "child_process";
import * as k8s from "@kubernetes/client-node";
import * as blessed from "blessed";
import * as k8sClient from "./lib/client";
import { AppState } from "./lib/app_state";
import { ResourceListWidget } from "./lib/widgets/resource_list_widget";
import { AppDefaults } from "./lib/app_defaults";
import { WidgetFactory } from "./lib/widget_factory";
import { TopBarWidget } from "./lib/widgets/top_bar_widget";
import { DrilldownWidget } from "./lib/widgets/drilldown_widget";

class App {
    private kubeConfig: k8s.KubeConfig;
    private client: k8sClient.K8sClient;

    private screen: blessed.Widgets.Screen;
    private topBar: TopBarWidget;
    private apiList: DrilldownWidget;
    private resourceListWidget: ResourceListWidget;

    private state: AppState;
    private stateFile: string;

    private constructor() {
        this.kubeConfig = new k8s.KubeConfig();
        this.kubeConfig.loadFromDefault();
        this.client = new k8sClient.K8sClient(this.kubeConfig);
        this.state = {
            namespace: null,
            namespaces: [],
            apiResource: null,
            apiResources: [],
        };
        this.stateFile = process.env.XDG_CONFIG_HOME || (process.env.HOME + "/.config") + "/kui/state.json";
    }

    private saveAppState() {
        let data = JSON.stringify(this.state, null, 2);
        let dir = path.dirname(this.stateFile);
        fs.mkdirSync(dir, {recursive: true, mode: 0o750});
        fs.writeFileSync(this.stateFile, data);
    }

    private loadAppState() {
        let data = fs.readFileSync(this.stateFile);
        this.state = JSON.parse(data.toString());
    }

    private async updateNamespaceList(doneCb: () => void) {
        this.client.getNamespaces((error, namespaces) => {
            if (error) {
                console.log("Error updating namespace list:", error);
                return;
            }
            // update state
            this.state.namespaces = namespaces;
            let index = -1;
            if (this.state.namespace !== null) {
                index = namespaces.findIndex(namespace => {
                    return namespace.metadata.name == this.state.namespace.metadata.name;
                });
            }
            if (index == -1) {
                index = 0;
            }
            this.state.namespace = namespaces[index];
            this.topBar.update();
            doneCb();
        });
    }

    private async updateApiList(doneCb: () => void) {
        this.client.getListableAPIResources((error, resources) => {
            if (error) {
                console.log(error);
                return;
            }
            // update state
            this.state.apiResources = resources;
            let index = -1;
            if (this.state.apiResource !== null) {
                index = resources.findIndex(resource => {
                    return resource.resource.name == this.state.apiResource.resource.name;
                });
            }
            if (index == -1) {
                index = 0;
            }
            this.state.apiResource = resources[index];
            this.apiList.setValues(resources.map(r => { return r.getLongName(); }));
            this.apiList.select(index);
            doneCb();
        }).catch(e => {
            console.log(e);
        });
    }

    private updateContents() {
        this.updateNamespaceList(() => {
            this.screen.render();
        });
        this.updateApiList(() => {
            this.screen.render();
        });
    }

    private main() {
        const self = this;

        let logDir = (process.env.XDG_CACHE_HOME || process.env.HOME + "/.cache") + "/kui";
        fs.mkdirSync(logDir, {recursive: true, mode: 0o750});
        let logFile = logDir + "/kui.log";

        this.screen = blessed.screen({
            smartCSR: true,
            log: logFile,
        });

        try {
            this.loadAppState();
        } catch (e) {
            this.screen.log(`Could not load config: ${e.toString()}`);
        }

        this.screen.title = "KUI";

        var box = blessed.box({
            parent: this.screen,
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            tags: true,
            focusable: false,
        });
        box.style.bg = AppDefaults.COLOR_BG;
        box.style.fg = AppDefaults.COLOR_FG;

        this.topBar = new TopBarWidget(box);
        this.topBar.addItems([{
            key: "c",
            labelCallback: () => {
                return `[C]ontext: ${this.kubeConfig.getCurrentContext()}`;
            },
            actionCallback: () => {
                const contexts = this.kubeConfig.getContexts();
                const currentContext = this.kubeConfig.getCurrentContext();
                const currentIndex = contexts.findIndex(context => { return context.name == currentContext; });
                const list = WidgetFactory.list(
                    "Choose Context",
                    contexts.map(context => { return context.name; }),
                    {
                        parent: box,
                    },
                    (context, index) => {
                        this.kubeConfig.setCurrentContext(contexts[index].name);
                        this.client.kubeConfig = this.kubeConfig;
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
                return `[N]amespace: ${this.state.namespace ? this.state.namespace.metadata.name : "n/a"}`;
            },
            actionCallback: () => {
                this.resourceListWidget.freeze();
                this.screen.saveFocus();
                const list = new DrilldownWidget(this.state.namespaces.map(n => { return n.metadata.name; }), {
                    parent: this.screen,
                    label: "Choose Namespace",
                });
                list.onSelect((value, index) => {
                    this.state.namespace = self.state.namespaces[index];
                    this.topBar.update();
                    this.resourceListWidget.refresh();
                });
                list.onClose(() => {
                    list.destroy();
                    this.screen.restoreFocus();
                    this.resourceListWidget.unfreeze();
                });
                list.onBlur(() => {
                    list.destroy();
                    this.screen.restoreFocus();
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

        this.apiList = new DrilldownWidget([], {
            label: "API Resources",
            parent: leftPane,
            top: 0,
            left: 0,
            width: "100%",
            height: "100%-1",
        });
        this.apiList.onSelect((value: string, index: number) => {
            if (index == -1) {
                this.state.apiResource = null;
            }
            else {
                this.state.apiResource = this.state.apiResources[index];
            }
            this.resourceListWidget.refresh();
            this.screen.focusNext();
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

        this.resourceListWidget = new ResourceListWidget(this.state, this.client);
        this.resourceListWidget.appendTo(mainPane);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.screen.key(["C-r"], (ch, key) => {
            self.updateContents();
        });

        this.screen.key(["C-l"], () => {
            // FIXME: dirty redraw hack
            box.hide();
            self.screen.render();
            box.show();
            self.screen.render();
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.screen.key(["q", "C-c", "C-q"], (ch, key) => {
            this.saveAppState();
            return process.exit(0);
        });

        this.screen.key(["tab"], () => {
            this.screen.focusNext();
        });
        this.screen.key(["S-tab"], () => {
            this.screen.focusPrevious();
        });

        this.screen.key(["]"], () => {
            this.resourceListWidget.cycleRefreshSlower();
        });

        this.screen.key(["["], () => {
            this.resourceListWidget.cycleRefreshFaster();
        });

        this.screen.key(["space"], () => {
            this.resourceListWidget.pause();
        });

        this.screen.key(["?", "h", "f1"], () => {
            this.help();
        });

        this.screen.render();
        this.resourceListWidget.focus();
        this.updateContents();
    }

    private help() {
        this.resourceListWidget.freeze();
        const helpBox = WidgetFactory.textBox({
            parent: this.screen,
            label: "Keyboard Shortcuts",
            top: "center",
            left: "center",
            width: 72,
            height: 24,
        });
        this.screen.grabKeys = true;
        helpBox.key("escape", () => {
            helpBox.destroy();
            this.screen.grabKeys = false;
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

    public static run() {
        const app = new App();
        app.main();
    }
}

App.run();
