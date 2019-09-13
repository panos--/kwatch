import * as fs from "fs";
import * as path from "path";
import * as k8s from "@kubernetes/client-node";
import * as blessed from "blessed";
import * as k8sClient from "./lib/client";
import { AppState } from "./lib/app_state";
import { ResourceListWidget } from "./lib/widgets/resource_list_widget";
import { AppDefaults } from "./lib/app_defaults";

class App {
    private kubeConfig: k8s.KubeConfig;
    private client: k8sClient.K8sClient;

    private screen: blessed.Widgets.Screen;
    private namespaceList: blessed.Widgets.ListElement;
    private apiList: blessed.Widgets.ListElement;

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
            this.namespaceList.clearItems();
            for (let namespace of namespaces) {
                this.namespaceList.addItem(namespace.metadata.name);
            }
            this.namespaceList.select(index);
            doneCb();
        });
    }

    private async updateApiList(doneCb: () => void) {
        const self = this;
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
            // reflect state in list
            self.apiList.clearItems();
            for (let resource of resources) {
                self.apiList.addItem(resource.getFullName());
            }
            self.apiList.select(index);
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
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            tags: true,
            focusable: false,
            style: {
                fg: "white",
                bg: "magenta",
                hover: {
                    bg: "green"
                }
            }
        });

        var leftPane = blessed.box({
            top: 0,
            left: 0,
            width: 30,
            height: "100%",
            focusable: false,
        });

        this.namespaceList = blessed.list({
            label: "Namespaces",
            top: 0,
            left: 0,
            width: "100%",
            height: "20%",
            mouse: true,
            keys: true,
            border: "line",
            scrollbar: {
                ch: " ",
                track: {
                    bg: "cyan"
                },
                style: {
                    inverse: true
                }
            },
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
                },
            },
        });
        this.namespaceList.on("focus", () => {
            this.namespaceList.style.border.bg = AppDefaults.COLOR_BG_FOCUS;
            this.screen.render();
        });
        this.namespaceList.on("blur", () => {
            this.namespaceList.style.border.bg = -1;
            this.screen.render();
        });
        this.namespaceList.on("select", (boxElement, index) => {
            this.state.namespace = self.state.namespaces[index];
            this.screen.focusNext();
        });

        this.apiList = blessed.list({
            label: "API Resources",
            top: "20%",
            left: 0,
            width: "100%",
            height: "80%",
            mouse: true,
            keys: true,
            border: "line",
            scrollbar: {
                ch: " ",
                track: {
                    bg: "cyan"
                },
                style: {
                    inverse: true
                }
            },
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
        this.apiList.on("focus", () => {
            this.apiList.style.border.bg = AppDefaults.COLOR_BG_FOCUS;
            this.screen.render();
        });
        this.apiList.on("blur", () => {
            this.apiList.style.border.bg = -1;
            this.screen.render();
        });
        this.apiList.on("select", (boxElement, index) => {
            self.state.apiResource = self.state.apiResources[index];
            this.screen.focusNext();
        });

        leftPane.append(this.namespaceList);
        leftPane.append(this.apiList);

        var mainPane = blessed.box({
            top: 0,
            left: 30,
            width: this.screen.cols - 30,
            height: "100%",
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

        let resourceListWidget = new ResourceListWidget(this.state, this.client);
        resourceListWidget.appendTo(mainPane);

        box.append(leftPane);
        box.append(mainPane);
        this.screen.append(box);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.screen.key(["C-r"], (ch, key) => {
            self.updateContents();
        });

        this.screen.key(["C-l"], () => {
            // FIXME: dirty redraw hack
            box.hide();
            // self.screen.clearRegion(0, self.screen.cols, 0, self.screen.rows);
            self.screen.render();
            box.show();
            self.screen.render();
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.screen.key(["q", "C-c"], (ch, key) => {
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
            resourceListWidget.cycleRefreshSlower();
        });

        this.screen.key(["["], () => {
            resourceListWidget.cycleRefreshFaster();
        });

        this.screen.key(["space"], () => {
            resourceListWidget.pause();
        });

        this.screen.render();
        this.namespaceList.focus();
        this.updateContents();
    }

    public static run() {
        const app = new App();
        app.main();
    }
}

App.run();
