import * as k8s from "@kubernetes/client-node";
import { V1Namespace } from "@kubernetes/client-node";
import * as blessed from "blessed";
import * as k8sClient from "./client";

class App {
    private client: k8sClient.K8sClient;

    private screen: blessed.Widgets.Screen;
    private namespaceList: blessed.Widgets.ListElement;
    private apiList: blessed.Widgets.ListElement;
    private resourceList: blessed.Widgets.ListElement;

    private state: {
        namespace: V1Namespace;
        namespaces: V1Namespace[];
        apiResource: k8sClient.APIResource;
        apiResources: k8sClient.APIResource[];
    };

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
                self.apiList.addItem(resource.getName());
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
                        bg: "blue"
                    }
                },
                selected: {
                    bg: "blue",
                    bold: true
                },
            },
        });
        this.namespaceList.focus();
        this.namespaceList.on("focus", () => {
            this.namespaceList.style.border.bg = 12;
            this.screen.render();
        });
        this.namespaceList.on("blur", () => {
            this.namespaceList.style.border.bg = -1;
            this.screen.render();
        });
        this.namespaceList.on("select", (boxElement, index) => {
            self.state.namespace = self.state.namespaces[index];
            this.namespaceList.getItem(index).fg = 3;
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
                        bg: "blue"
                    }
                },
                selected: {
                    bg: "blue",
                    bold: true
                }
            },
        });
        this.apiList.on("focus", () => {
            this.apiList.style.border.bg = 12;
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
            style: {
                fg: "white",
                bg: "blue",
                hover: {
                    bg: "green"
                }
            }
        });

        this.resourceList = blessed.list({
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
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
                        bg: "blue"
                    }
                },
                selected: {
                    bg: "blue",
                    bold: true
                }
            },
        });
        this.resourceList.on("focus", () => {
            this.resourceList.style.border.bg = 12;
            this.screen.render();
        });
        this.resourceList.on("blur", () => {
            this.resourceList.style.border.bg = -1;
            this.screen.render();
        });
        let activeResource: blessed.Widgets.BlessedElement = null;
        let activeResourceIndex = 0;
        this.resourceList.on("select item", (item, index) => {
            activeResource = item;
            activeResourceIndex = index;
        });

        mainPane.append(this.resourceList);

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
        this.screen.key(["escape", "q", "C-c"], function(ch, key) {
            return process.exit(0);
        });

        this.screen.key(["tab"], () => {
            this.screen.focusNext();
        });
        this.screen.key(["S-tab"], () => {
            this.screen.focusPrevious();
        });

        this.screen.render();
        this.updateContents();

        let paused = false;
        let interval = 3;
        let intervals = [10, 5, 2, 1, 0.5];
        let timeout: NodeJS.Timeout = null;
        let lastNamespaceName = "";
        let lastApiResourceName = "";
        let lastTimestamp = "";
        function updateResourceList() {
            if (self.state.namespace !== undefined && self.state.apiResource !== undefined) {
                let refreshRate = interval == -1 ? "Paused" : (intervals[interval] + "s");
                let namespaceName;
                let apiResourceName;
                let timestamp;
                if (paused) {
                    refreshRate = "Paused";
                    namespaceName = lastNamespaceName;
                    apiResourceName = lastApiResourceName;
                    timestamp = lastTimestamp;
                }
                else {
                    namespaceName = lastNamespaceName = self.state.namespace.metadata.name;
                    apiResourceName = lastApiResourceName = self.state.apiResource.resource.name;
                    let now = new Date();
                    timestamp = lastTimestamp = now.toLocaleString(undefined, {
                        hour12: false,
                    }) + "." + now.getMilliseconds();
                }

                let label = `[${refreshRate}] ${namespaceName} / ${apiResourceName} @ ${timestamp}`;

                if (paused) {
                    self.resourceList.setLabel(label);
                    self.screen.render();
                    return;
                }
                else {
                    self.client.listResourcesFormatted(self.state.namespace.metadata.name, [
                        self.state.apiResource.resource.name
                    ], (error, lines) => { 
                        let lastActive = activeResource;
                        let lastActiveIndex = activeResourceIndex;
                        self.resourceList.setLabel(label);
                        self.resourceList.clearItems();
                        if (error) {
                            self.resourceList.addItem(error.name);
                            self.resourceList.addItem(error.message);
                        }
                        else {
                            for (let line of lines) {
                                self.resourceList.addItem(line);
                            }
                        }
                        self.resourceList.select(lastActiveIndex);
                        self.resourceList.scrollTo(lastActiveIndex);
                        // self.resourceList.focus();
                        self.screen.render();
                    });
                }
            }
            timeout = setTimeout(updateResourceList, intervals[interval] * 1000);
        }
        timeout = setTimeout(updateResourceList, 500);

        this.screen.key(["]"], () => {
            paused = false;
            if (timeout !== null) {
                clearTimeout(timeout);
                timeout = null;
            }
            interval--;
            if (interval < 0) {
                interval = intervals.length - 1;
            }
            setTimeout(updateResourceList, 100);
        });

        this.screen.key(["["], () => {
            paused = false;
            if (timeout !== null) {
                clearTimeout(timeout);
                timeout = null;
            }
            if (interval >= intervals.length - 1) {
                interval = 0;
            }
            else {
                interval++;
            }
            setTimeout(updateResourceList, 100);
        });

        this.screen.key(["space"], () => {
            if (timeout !== null) {
                clearTimeout(timeout);
                timeout = null;
            }
            paused = !paused;
            setTimeout(updateResourceList, 100);
        });
    }

    public static run() {
        const app = new App();
        app.main();
    }
}

App.run();
