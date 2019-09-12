import * as k8s from "@kubernetes/client-node";
import { V1Namespace } from "@kubernetes/client-node";
import * as blessed from "blessed";
import * as k8sClient from "./lib/client";
import { AppState } from "./lib/app_state";
import { ResourceListWidget } from "./lib/widgets/resource_list_widget";
import { AppDefaults } from "./lib/app_defaults";

class App {
    private client: k8sClient.K8sClient;

    private screen: blessed.Widgets.Screen;
    private namespaceList: blessed.Widgets.ListElement;
    private apiList: blessed.Widgets.ListElement;

    private state: AppState;

    private constructor() {
        this.state = {
            namespace: undefined,
            namespaces: [],
            apiResource: undefined,
            apiResources: [],
        };
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        this.client = new k8sClient.K8sClient(kc);
    }

    private updateNamespaceList(doneCb: () => void) {
        const self = this;
        this.client.getNamespaces((namespaces: V1Namespace[]) => {
            self.state.namespaces = namespaces;
            self.namespaceList.clearItems();
            for (let namespace of namespaces) {
                self.namespaceList.addItem(namespace.metadata.name);
            }
            self.namespaceList.select(0);
            self.namespaceList.emit("select", null, 0);
            doneCb();
        });
    }

    private updateApiList(doneCb: () => void) {
        const self = this;
        this.client.getAPIResources(resources => {
            self.state.apiResources = resources;
            self.apiList.clearItems();
            for (let resource of resources) {
                self.apiList.addItem(resource.getFullName());
            }
            self.apiList.select(0);
            self.apiList.emit("select", null, 0);
            doneCb();
        });
    }

    private updateContents() {
        this.updateNamespaceList(() => {
            // this.namespaceList.focus();
            this.screen.render();
        });
        this.updateApiList(() => {
            // this.apiList.focus();
            this.screen.render();
        });
    }

    private main() {
        const self = this;

        this.screen = blessed.screen({
            smartCSR: true
        });

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
        this.namespaceList.focus();
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
            // this.namespaceList.getItem(index).fg = 3;
        });

        this.apiList = blessed.list({
            label: "Resources",
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
        });

        leftPane.append(this.namespaceList);
        leftPane.append(this.apiList);

        var mainPane = blessed.box({
            top: 0,
            left: 30,
            width: this.screen.cols - 30,
            height: "100%",
            keys: true,
            vi: true,
            alwaysScroll:true,
            scrollable: true,
            focusable: false, // doesn't work...
            style: {
                fg: "white",
                bg: "blue",
                hover: {
                    bg: "green"
                }
            }
        });
        mainPane.on("focus", () => {
            this.screen.focusNext();
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
        this.screen.key(["q", "C-c"], function(ch, key) {
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
        this.updateContents();
    }

    public static run() {
        const app = new App();
        app.main();
    }
}

App.run();
