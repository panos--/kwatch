import * as blessed from "blessed";
import { APIResource } from "../client";
import { ResourceActionMenu } from "./resource_action_menu";
import { V1Namespace } from "@kubernetes/client-node";
import { AppContext } from "../app_context";

export class ResourceListWidget {
    private static readonly DEFAULT_INTERVAL = 3;

    private ctx: AppContext;

    private paused = false;
    private frozen = false;
    private interval = ResourceListWidget.DEFAULT_INTERVAL;
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

    public constructor(ctx: AppContext) {
        this.ctx = ctx;
        this.init();
    }

    private init() {
        this.interval = this.ctx.state.refreshInterval;
        if (this.interval === undefined || this.interval === null
            || this.interval < 0 || this.interval >= this.intervals.length) {
            this.interval = ResourceListWidget.DEFAULT_INTERVAL;
        }
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
                    bg: this.ctx.colorScheme.COLOR_SCROLLBAR_BG
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
        this.resourceList.style.border.bg = this.ctx.colorScheme.COLOR_BORDER_BG;
        this.resourceList.on("focus", () => {
            this.resourceList.style.border.bg = this.ctx.colorScheme.COLOR_BORDER_BG_FOCUS;
            this.render();
        });
        this.resourceList.on("blur", () => {
            this.resourceList.style.border.bg = this.ctx.colorScheme.COLOR_BORDER_BG;
            this.render();
        });
        this.resourceList.key("pageup", () => {
            // NOTE: not correct but better than nothing (scroll jumps on refreshes...)
            let height = this.resourceList.height;
            height = (typeof height == "number" ? height : parseInt(height));
            let offset = -(height / 2 | 0) || -1;
            this.resourceList.select(this.activeResourceIndex + offset);
            this.resourceList.scrollTo(this.activeResourceIndex + offset);
        });
        this.resourceList.key("pagedown", () => {
            // NOTE: not correct but better than nothing (scroll jumps on refreshes...)
            let height = this.resourceList.height;
            height = (typeof height == "number" ? height : parseInt(height));
            let offset = (height / 2 | 0) || -1;
            this.resourceList.select(this.activeResourceIndex + offset);
            this.resourceList.scrollTo(this.activeResourceIndex + offset);
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
                apiResource = this.ctx.state.apiResources.find((apiResource) => {
                    if (apiResource.resource.name == apiResourceName) {
                        return true;
                    }
                });
                if (apiResource === undefined) {
                    return;
                }

                resource = resParts[1];
            }

            if (this.currentNamespace && apiResource) {
                this.showActionMenu(this.currentNamespace, apiResource, resource);
            }
        });

        this.actionMenu = new ResourceActionMenu(this.ctx, this.resourceList);
        this.actionMenu.onAfterClose(() => { this.unfreeze(); });

        this.run();
    }

    public appendTo(box: blessed.Widgets.BoxElement) {
        box.append(this.resourceList);
        this.ctx.screen = this.resourceList.screen;
    }

    private render() {
        if (this.ctx.screen !== null) {
            this.ctx.screen.render();
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

        if (this.frozen || this.ctx.state.namespace === null || this.ctx.state.apiResource === null) {
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
            namespace = this.ctx.state.namespace;
            apiResource = this.ctx.state.apiResource;
            time = new Date();
            refreshRate = this.intervals[this.interval] + "s";
        }

        let namespaceName = this.ctx.state.namespace.metadata.name;
        let apiResourceName = this.ctx.state.apiResource.resource.name;
        let timestamp = time.toLocaleString(undefined, {
            hour12: false,
        }) + "." + time.getMilliseconds();

        let label = `[${refreshRate}] ${namespaceName} / ${apiResourceName} @ ${timestamp}`;

        if (this.paused) {
            this.resourceList.setLabel(label);
            this.render();
            return;
        }

        this.ctx.client.listResourcesFormatted(namespace.metadata.name, [
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

    public cycleRefreshSlower() {
        this.paused = false;
        this.unschedule();
        this.interval--;
        if (this.interval < 0) {
            this.interval = this.intervals.length - 1;
        }
        this.ctx.state.refreshInterval = this.interval;
        this.timeout = setTimeout(() => { this.update(); }, 100);
    }

    public cycleRefreshFaster() {
        this.paused = false;
        this.unschedule();
        if (this.interval >= this.intervals.length - 1) {
            this.interval = 0;
        }
        else {
            this.interval++;
        }
        this.ctx.state.refreshInterval = this.interval;
        this.timeout = setTimeout(() => { this.update(); }, 100);
    }

    public pause() {
        this.unschedule();
        this.paused = !this.paused;
        this.timeout = setTimeout(() => { this.update(); }, 100);
    }

    private unschedule() {
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    public freeze() {
        this.frozen = true;
    }

    public unfreeze() {
        this.frozen = false;
    }

    public refresh() {
        this.unschedule();
        this.run();
    }

    public focus() {
        this.resourceList.focus();
    }

    private run() {
        this.timeout = setTimeout(() => { this.update(); }, 50);
    }
}
