import * as blessed from "blessed";
import { AppState } from "./app_state";
import * as k8sClient from "./client";

export class ResourceListWidget {
    private state: AppState;
    private client: k8sClient.K8sClient;

    private screen: blessed.Widgets.Screen = null;

    private paused = false;
    private frozen = false;
    private interval = 3;
    private intervals = [10, 5, 2, 1, 0.5];

    private lastNamespaceName = "";
    private lastApiResourceName = "";
    private lastTimestamp = "";

    private activeResource: blessed.Widgets.BlessedElement = null;
    private activeResourceIndex = 0;

    private timeout: NodeJS.Timeout = null

    private resourceList: blessed.Widgets.ListElement;
    private contextMenu: blessed.Widgets.ListElement;

    public constructor(state: AppState, client: k8sClient.K8sClient) {
        this.state = state;
        this.client = client;
        this.init();
    }

    private init() {
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
        this.resourceList.on("focus", () => {
            this.resourceList.style.border.bg = 12;
            this.render();
        });
        this.resourceList.on("blur", () => {
            this.resourceList.style.border.bg = -1;
            this.render();
        });
        this.resourceList.on("select item", (item, index) => {
            this.activeResource = item;
            this.activeResourceIndex = index;
        });

        this.contextMenu = blessed.list({
            top: 15,
            left: 55,
            width: 40,
            height: 15,
            mouse: true,
            keys: true,
            border: "line",
            hidden: true,
            items: ["foo", "bar", "baz", "qux"],
            shrink: true,
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
        this.contextMenu.style.border.bg = 12;
        this.contextMenu.on("blur", () => {
            this.closeContextMenu();
        });
        this.contextMenu.on("cancel", () => {
            this.closeContextMenu();
        });
        this.contextMenu.on("select", (item, index) => {
            this.closeContextMenu();
            console.log(`Selected item number ${index}:`, item.getText());
            this.executeContextMenuAction(index);
        });
        this.resourceList.append(this.contextMenu);
        this.resourceList.on("select", (item, index) => {
            let line = item.getText();
            if (line.trim().length == 0) {
                return;
            }
            let parts = line.split(/\s+/, 2);
            if (parts.length == 0) {
                return;
            }
            let maybePrefixedResource = parts[0];
            if (maybePrefixedResource == maybePrefixedResource.toLocaleUpperCase()) {
                // not a resource but a resource table header
                return;
            }
            let apiResourceName: string = null;
            let resource;
            let resParts = maybePrefixedResource.split(/\//, 2);
            if (resParts.length == 0) {
                // cannot happen
                return;
            }
            else if (resParts.length == 1) {
                // TODO: must use the one stored in resourceList, not in state
                apiResourceName = this.lastApiResourceName;
                resource = resParts[0];
            }
            else {
                apiResourceName = resParts[0];
                resource = resParts[1];
            }

            let apiResource = this.state.apiResources.find((apiResource) => {
                if (apiResource.resource.name == apiResourceName) {
                    return true;
                }
            });
            if (apiResource === undefined) {
                return;
            }
            this.showContextMenu(this.lastNamespaceName, apiResource, resource);
        });

        this.run();
    }

    public appendTo(box: blessed.Widgets.BoxElement) {
        box.append(this.resourceList);
        this.screen = this.resourceList.screen;
    }

    private render() {
        if (this.screen !== null) {
            this.screen.render();
        }
    }

    private showContextMenu(namespace: string, apiResource: k8sClient.APIResource, resource: string) {
        this.freeze();
        this.populateContextMenu(namespace, apiResource, resource);
        this.contextMenu.setIndex(100);
        this.contextMenu.show();
        this.contextMenu.focus();
        this.render();
    }

    private contextMenuActions: (() => void)[] = [];
    private populateContextMenu(namespace: string, apiResource: k8sClient.APIResource, resource: string) {
        this.contextMenu.clearItems();
        this.contextMenuActions = [];
        this.contextMenu.addItem("Describe");
        this.contextMenuActions.push(() => {
            this.actionDescribe(namespace, apiResource, resource);
        });
    }

    private executeContextMenuAction(index: number) {
        this.contextMenuActions[index]();
    }

    private actionDescribe(namespace: string, apiResource: k8sClient.APIResource, resource: string) {
        // console.log(`would describe ${namespace}, ${apiResource.getName()}/${resource}`);
        this.client.describeResource(namespace, apiResource, resource, (error, lines) => {
            let box = blessed.box({
                top: 3,
                left: 5,
                height: "100%-6",
                width: "100%-10",
                mouse: true,
                keys: true,
                border: "line",
                scrollable: true,
                scrollbar:  {
                    ch: " ",
                    track: {
                        bg: "cyan"
                    },
                    style: {
                        inverse: true
                    }
                },
            });
            box.key("escape", () => {
                box.destroy();
                this.screen.render();
            });
            box.setIndex(100);
            this.screen.append(box);
            
            if (error) {
                console.log(error.message);
                return;
            }
            else {
                box.insertBottom(lines);
            }

            box.focus();
            this.screen.render();
        });
    }

    private closeContextMenu() {
        this.contextMenu.hide();
        this.render();
        this.unfreeze();
    }

    private update() {
        if (!this.frozen && this.state.namespace !== undefined && this.state.apiResource !== undefined) {
            let refreshRate = this.interval == -1 ? "Paused" : (this.intervals[this.interval] + "s");
            let namespaceName;
            let apiResourceName;
            let timestamp;
            if (this.paused) {
                refreshRate = "Paused";
                namespaceName = this.lastNamespaceName;
                apiResourceName = this.lastApiResourceName;
                timestamp = this.lastTimestamp;
            }
            else {
                namespaceName = this.lastNamespaceName = this.state.namespace.metadata.name;
                apiResourceName = this.lastApiResourceName = this.state.apiResource.resource.name;
                let now = new Date();
                timestamp = this.lastTimestamp = now.toLocaleString(undefined, {
                    hour12: false,
                }) + "." + now.getMilliseconds();
            }

            let label = `[${refreshRate}] ${namespaceName} / ${apiResourceName} @ ${timestamp}`;

            if (this.paused) {
                this.resourceList.setLabel(label);
                this.render();
                return;
            }
            else {
                this.client.listResourcesFormatted(this.state.namespace.metadata.name, [
                    this.state.apiResource.resource.name
                ], (error, lines) => {
                    if (this.paused || this.frozen) {
                        return;
                    }
                    let lastActive = this.activeResource;
                    let lastActiveIndex = this.activeResourceIndex;
                    this.resourceList.setLabel(label);
                    this.resourceList.clearItems();
                    if (error) {
                        this.resourceList.addItem(error.name);
                        this.resourceList.addItem(error.message);
                    }
                    else {
                        for (let line of lines) {
                            this.resourceList.addItem(line);
                        }
                    }
                    this.resourceList.select(lastActiveIndex);
                    this.resourceList.scrollTo(lastActiveIndex);
                    // self.resourceList.focus();
                    this.render();
                });
            }
        }

        this.timeout = setTimeout(() => { this.update(); }, this.intervals[this.interval] * 1000);
    }

    public cycleRefreshFaster() {
        this.paused = false;
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        this.interval--;
        if (this.interval < 0) {
            this.interval = this.intervals.length - 1;
        }
        this.timeout = setTimeout(() => { this.update(); }, 100);
    }

    public cycleRefreshSlower() {
        this.paused = false;
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        if (this.interval >= this.intervals.length - 1) {
            this.interval = 0;
        }
        else {
            this.interval++;
        }
        this.timeout = setTimeout(() => { this.update(); }, 100);
    }

    public pause() {
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        this.paused = !this.paused;
        this.timeout = setTimeout(() => { this.update(); }, 100);
    }

    public freeze() {
        this.frozen = true;
    }

    public unfreeze() {
        this.frozen = false;
    }

    private run() {
        this.timeout = setTimeout(() => { this.update(); }, 500);
    }
}
