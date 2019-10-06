import * as blessed from "blessed";
import { APIResource } from "../client";
import { ResourceActionMenu } from "./resource_action_menu";
import { V1Namespace } from "@kubernetes/client-node";
import { AppContext } from "../app_context";
import { TypeaheadWidget } from "./typeahead_widget";
import { SelectListWidget, OptionList, OptionItem } from "./select_list_widget";
import { LooseMatcher } from "../search/loose_matcher";

interface TypedResource {
    type: APIResource;
    name: string;
}

export class ResourceListWidget {
    private static readonly DEFAULT_INTERVAL = 3;

    private ctx: AppContext;

    private paused = false;
    private frozen = false;
    private interval = ResourceListWidget.DEFAULT_INTERVAL;
    private intervals = [10, 5, 2, 1, 0.5];

    // the parameters for which the list currently shows data
    private currentNamespace: V1Namespace = null;
    private currentAPIResource: APIResource = null;
    private currentTime: Date = null;

    private timeout: NodeJS.Timeout = null

    private resourceList: SelectListWidget<TypedResource>;
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
        this.resourceList = new SelectListWidget<TypedResource>({
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
        this.resourceList.onFocus(() => {
            this.resourceList.style.border.bg = this.ctx.colorScheme.COLOR_BORDER_BG_FOCUS;
            this.render();
        });
        this.resourceList.onBlur(() => {
            this.resourceList.style.border.bg = this.ctx.colorScheme.COLOR_BORDER_BG;
            this.render();
        });
        this.resourceList.key("/", () => {
            this.freeze();
            const typeahead = new TypeaheadWidget(this.ctx, {
                parent: this.ctx.screen,
            });
            typeahead.on("search", (search, options, ret) => {
                const option = this.search(search, options);

                if (option === null) {
                    ret.found = false;
                    return;
                }

                this.resourceList.select(option);

                ret.found = true;
            });
            typeahead.on("destroy", () => {
                this.unfreeze();
            });
            typeahead.focus();
        });
        this.resourceList.onSubmit(resource => {
            if (!resource) {
                return;
            }
            if (this.currentNamespace && resource.type) {
                this.showActionMenu(this.currentNamespace, resource.type, resource.name);
            }
        });

        this.actionMenu = new ResourceActionMenu(this.ctx, this.ctx.screen);
        this.actionMenu.onAfterClose(() => { this.unfreeze(); });

        this.run();
    }

    private search(search: string, options: { forward: boolean; next: boolean }): OptionItem<TypedResource> {
        const matcher = new LooseMatcher(search);

        const values = this.resourceList.options.toArray();
        const forward = options.forward;
        const offset = options.next ? (forward ? 1 : -1) : 0;
        for (
            let i = this.resourceList.getSelectedIndex() + offset;
            forward ? i < values.length : i >= 0;
            i += forward ? 1 : -1
        ) {
            const value = values[i];
            if (!("value" in value)) {
                continue;
            }
            if (!value.value) {
                continue;
            }
            if (matcher.test(value.value.name)) {
                return value;
            }
        }
        return null;
    }

    public parseResourceFromLine(line: string): TypedResource|null {
        if (line.trim().length == 0) {
            return null;
        }
        let parts = line.split(/\s+/, 2);
        if (parts.length == 0) {
            return null;
        }

        let maybePrefixedResource = parts[0];
        if (maybePrefixedResource == maybePrefixedResource.toLocaleUpperCase()) {
            // not a resource but a resource table header
            return null;
        }

        let apiResource;
        let resource;
        let resParts = maybePrefixedResource.split(/\//, 2);
        if (resParts.length == 0) {
            // cannot happen
            return null;
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
                return null;
            }

            resource = resParts[1];
        }

        return {
            type: apiResource,
            name: resource,
        };
    }

    public appendTo(box: blessed.Widgets.BoxElement) {
        box.append(this.resourceList.node);
        this.ctx.screen = this.resourceList.node.screen;
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
        let timestamp = time.toLocaleString() +
            " " + ("" + time.getMilliseconds()).padStart(3, "0") + "ms";

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

            let selectedOption = this.resourceList.getSelectedOption();
            let selectedIndex = this.resourceList.getSelectedIndex();

            if (!this.currentNamespace
                || !namespace
                || this.currentNamespace.metadata.name != namespace.metadata.name
                || !this.currentAPIResource
                || !apiResource
                || this.currentAPIResource.getLongName() != apiResource.getLongName()) {
                selectedOption = null;
                selectedIndex = -1;
            }

            this.currentNamespace = namespace;
            this.currentAPIResource = apiResource;
            this.currentTime = time;

            this.resourceList.setLabel(label);
            const entries = new OptionList<TypedResource>();
            if (error) {
                entries.addOption({
                    label: `${error.name}: ${error.message}`,
                    value: null,
                });
            }
            else {
                for (let line of lines) {
                    const resource = this.parseResourceFromLine(line);
                    entries.addOption({
                        label: line,
                        value: resource,
                    });
                }
            }
            this.resourceList.options = entries;

            if (selectedOption) {
                if ("options" in selectedOption) {
                    // should not be reached as we don't have option groups
                    // in the list, but you never know...
                }
                else if (!selectedOption.value) {
                    // this is a non-resource line (header, separator) on the
                    // list.
                    // do nothing - else what we would have to do would be
                    // to compare by label, taking into account that these
                    // are regularly not unique in the resource list (i.e.
                    // empty lines, header lines) when we eventually support
                    // multiple resource types in the list (ala `kubectl get all`).
                    // instead for now we rely on index based re-select and
                    // plan to eventually ensure only OptionItems are possible
                    // to be selected in the list
                }
                else {
                    const selectedResource = selectedOption.value;
                    const selectedResourceIndex = entries.toArray().findIndex(entry => {
                        if (!("value" in entry)) {
                            // should not be reached as we don't have option groups
                            // in the list, but you never know...
                            return false;
                        }
                        const resource = entry.value;
                        if (!resource) {
                            return false;
                        }
                        if (resource.name != selectedResource.name) {
                            return false;
                        }
                        if (resource.type.getLongName() != selectedResource.type.getLongName()) {
                            return false;
                        }
                        return true;
                    });
                    if (selectedResourceIndex != -1) {
                        selectedIndex = selectedResourceIndex;
                    }
                }
            }
            this.resourceList.selectIndex(selectedIndex);
            this.resourceList.scrollTo(selectedIndex);

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
