import * as blessed from "blessed";
import { AppState } from "../app_state";
import { K8sClient, APIResource } from "../client";
import { ResourceActionMenu } from "./resource_action_menu";
import { V1Namespace } from "@kubernetes/client-node";

export class ResourceListWidget {
    private state: AppState;
    private client: K8sClient;

    private screen: blessed.Widgets.Screen = null;

    private paused = false;
    private frozen = false;
    private interval = 3;
    private intervals = [10, 5, 2, 1, 0.5];

    // the currently selected list entry
    private activeResourceIndex = 0;

    // the parameters for which the list currently shows data
    private currentNamespace: V1Namespace = null;
    private currentAPIResource: APIResource = null;
    private currentTime: Date = null;

    private timeout: NodeJS.Timeout = null

    private resourceList: blessed.Widgets.ListElement;
    private actionMenu: ResourceActionMenu;

    public constructor(state: AppState, client: K8sClient) {
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
            this.activeResourceIndex = index;
        });
        this.resourceList.on("select", (item) => {
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

            let apiResource;
            let resource;
            let resParts = maybePrefixedResource.split(/\//, 2);
            if (resParts.length == 0) {
                // cannot happen
                return;
            }
            else if (resParts.length == 1) {
                apiResource = this.currentAPIResource;
                resource = resParts[0];
            }
            else {
                let apiResourceName = resParts[0];
                apiResource = this.state.apiResources.find((apiResource) => {
                    if (apiResource.resource.name == apiResourceName) {
                        return true;
                    }
                });
                if (apiResource === undefined) {
                    return;
                }

                resource = resParts[1];
            }

            this.showActionMenu(this.currentNamespace, apiResource, resource);
        });

        this.actionMenu = new ResourceActionMenu(this.state, this.client);
        this.actionMenu.appendTo(this.resourceList);

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

    private showActionMenu(namespace: V1Namespace, apiResource: APIResource, resource: string) {
        this.freeze();
        this.actionMenu.show(namespace, apiResource, resource);
    }

    private update() {
        function reschedule() {
            this.timeout = setTimeout(() => { this.update(); }, this.intervals[this.interval] * 1000);
        }

        if (this.frozen || this.state.namespace === undefined || this.state.apiResource === undefined) {
            reschedule.call(this);
            return;
        }

        let namespace: V1Namespace;
        let apiResource: APIResource;
        let time: Date;
        let refreshRate: string;

        if (this.paused) {
            if (this.currentNamespace === null || this.currentAPIResource === null || this.currentTime === null) {
                return;
            }
            namespace = this.currentNamespace;
            apiResource = this.currentAPIResource;
            time = this.currentTime;
            refreshRate = "Paused";
        }
        else {
            namespace = this.state.namespace;
            apiResource = this.state.apiResource;
            time = new Date();
            refreshRate = this.intervals[this.interval] + "s";
        }

        let namespaceName = this.state.namespace.metadata.name;
        let apiResourceName = this.state.apiResource.resource.name;
        let timestamp = time.toLocaleString(undefined, {
            hour12: false,
        }) + "." + time.getMilliseconds();

        let label = `[${refreshRate}] ${namespaceName} / ${apiResourceName} @ ${timestamp}`;

        if (this.paused) {
            this.resourceList.setLabel(label);
            this.render();
            return;
        }

        this.client.listResourcesFormatted(namespace.metadata.name, [
            apiResource.resource.name
        ], (error, lines) => {
            if (this.paused || this.frozen) {
                return;
            }

            let activeResourceIndex = this.activeResourceIndex;

            this.currentNamespace = namespace;
            this.currentAPIResource = apiResource;
            this.currentTime = time;

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
            this.resourceList.select(activeResourceIndex);
            this.resourceList.scrollTo(activeResourceIndex);

            this.render();
        });

        reschedule.call(this);
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
